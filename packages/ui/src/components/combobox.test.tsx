import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ComboboxField, ComboboxMultiField } from "@workspace/ui/components/combobox"
import type { ComboboxOption } from "@workspace/ui/components/combobox"

const COUNTRIES: ComboboxOption[] = [
  { value: "MV", label: "Maldives", keywords: "MV MDV", detail: "+960" },
  { value: "LK", label: "Sri Lanka", keywords: "LK LKA", detail: "+94" },
  { value: "AE", label: "United Arab Emirates", keywords: "AE ARE", detail: "+971" },
]

const TYPES: ComboboxOption[] = [
  { value: "hospital", label: "Hospital", group: "Health" },
  { value: "clinic", label: "Clinic", group: "Health" },
  { value: "school", label: "School", group: "Education" },
]

function Single({ onChange = () => {}, options = COUNTRIES }: { onChange?: (v: string | null) => void; options?: ComboboxOption[] }) {
  const [value, setValue] = React.useState<string | null>(null)
  return <ComboboxField aria-label="Country" placeholder="Pick a country" value={value} onValueChange={(v) => (setValue(v), onChange(v))} options={options} />
}

function Multi({ onChange = () => {} }: { onChange?: (v: string[]) => void }) {
  const [value, setValue] = React.useState<string[]>([])
  return <ComboboxMultiField aria-label="Types" value={value} onValueChange={(v) => (setValue(v), onChange(v))} options={TYPES} />
}

describe("ComboboxField", () => {
  it("narrows the list to what is typed, matching the label", async () => {
    const user = userEvent.setup()
    render(<Single />)
    await user.type(screen.getByRole("combobox", { name: "Country" }), "lan")
    const options = await screen.findAllByRole("option")
    expect(options.map((o) => o.textContent)).toEqual(["Sri Lanka+94"])
  })

  it("matches the keywords too, so a code finds its country", async () => {
    const user = userEvent.setup()
    render(<Single />)
    await user.type(screen.getByRole("combobox", { name: "Country" }), "mdv")
    const options = await screen.findAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("Maldives")
  })

  it("chooses with the keyboard and reports the value", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Single onChange={onChange} />)
    const input = screen.getByRole("combobox", { name: "Country" })
    await user.type(input, "united")
    await screen.findAllByRole("option")
    await user.keyboard("{Enter}")
    expect(onChange).toHaveBeenLastCalledWith("AE")
    expect(input).toHaveValue("United Arab Emirates")
  })

  it("says so when nothing matches", async () => {
    const user = userEvent.setup()
    render(<Single />)
    await user.type(screen.getByRole("combobox", { name: "Country" }), "zzz")
    expect(await screen.findByText("No matches.")).toBeInTheDocument()
    expect(screen.queryAllByRole("option")).toHaveLength(0)
  })

  it("shows grouped options under their headings", async () => {
    const user = userEvent.setup()
    render(<Single options={TYPES} />)
    await user.click(screen.getByRole("button", { name: "Show choices" }))
    const groups = within(await screen.findByRole("listbox")).getAllByRole("group")
    expect(groups.map((g) => within(g).getAllByRole("option").map((o) => o.textContent))).toEqual([["Hospital", "Clinic"], ["School"]])
    expect(screen.getByText("Health")).toBeInTheDocument()
    expect(screen.getByText("Education")).toBeInTheDocument()
  })
})

describe("Escape", () => {
  it("closes the list but never clears the choice", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Multi onChange={onChange} />)
    const input = screen.getByRole("combobox", { name: "Types" })
    await user.type(input, "hosp")
    await user.click(await screen.findByRole("option", { name: "Hospital" }))
    await user.keyboard("{Escape}")
    await user.keyboard("{Escape}")
    expect(onChange).toHaveBeenLastCalledWith(["hospital"])
    expect(screen.getByText("Hospital")).toBeInTheDocument()
  })
})

describe("ComboboxMultiField", () => {
  it("adds each choice as a chip and removes it again", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Multi onChange={onChange} />)
    const input = screen.getByRole("combobox", { name: "Types" })

    await user.type(input, "hosp")
    await user.click(await screen.findByRole("option", { name: "Hospital" }))
    await user.type(input, "school")
    await user.click(await screen.findByRole("option", { name: "School" }))
    expect(onChange).toHaveBeenLastCalledWith(["hospital", "school"])

    await user.click(screen.getAllByRole("button", { name: "Remove" })[0])
    expect(onChange).toHaveBeenLastCalledWith(["school"])
  })

  it("adds the highlighted choice with Enter, as the single field does", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Multi onChange={onChange} />)
    const input = screen.getByRole("combobox", { name: "Types" })

    await user.type(input, "clin")
    await screen.findByRole("option", { name: "Clinic" })
    await user.keyboard("{Enter}")
    expect(onChange).toHaveBeenLastCalledWith(["clinic"])
    await user.type(input, "scho")
    await screen.findByRole("option", { name: "School" })
    await user.keyboard("{Enter}")
    expect(onChange).toHaveBeenLastCalledWith(["clinic", "school"])
  })
})

import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import {
  Select,
  SelectContent,
  SelectField,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

const PLANS = ["Starter", "Growth", "Institution"]

/** Opens the picker and waits for the list — the popup mounts a tick after the click. */
async function open(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("combobox", { name }))
  await screen.findAllByRole("option")
}

function Controlled({ onChange = () => {}, ...rest }: { onChange?: (v: string) => void } & Partial<React.ComponentProps<typeof SelectField>>) {
  const [value, setValue] = React.useState("Starter")
  return (
    <SelectField
      aria-label="Plan"
      value={value}
      onValueChange={(v) => (setValue(v), onChange(v))}
      options={PLANS}
      {...rest}
    />
  )
}

describe("SelectField", () => {
  it("shows the current value on the closed trigger", () => {
    render(<Controlled />)
    expect(screen.getByRole("combobox", { name: "Plan" })).toHaveTextContent("Starter")
  })

  it("opens on click, lists every option and emits the picked one", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)

    await open(user, "Plan")
    expect(screen.getAllByRole("option")).toHaveLength(3)

    await user.click(screen.getByRole("option", { name: "Growth" }))
    expect(onChange).toHaveBeenCalledWith("Growth")
    expect(screen.getByRole("combobox", { name: "Plan" })).toHaveTextContent("Growth")
  })

  it("marks the selected option and no other", async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    await open(user, "Plan")
    expect(screen.getByRole("option", { name: "Starter" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("option", { name: "Growth" })).toHaveAttribute("aria-selected", "false")
  })

  it("takes {value,label} options, emitting the value and showing the label", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Controlled
        onChange={onChange}
        options={[
          { value: "all", label: "Anyone" },
          { value: "mv", label: "Maldivian" },
        ]}
      />
    )
    await open(user, "Plan")
    await user.click(screen.getByRole("option", { name: "Maldivian" }))
    expect(onChange).toHaveBeenCalledWith("mv")
  })

  it("skips a disabled option", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} options={[{ value: "x", label: "Locked", disabled: true }, "Growth"]} />)
    await open(user, "Plan")
    await user.click(screen.getByRole("option", { name: "Locked" }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("shows the placeholder while nothing is chosen and does not open when disabled", async () => {
    const user = userEvent.setup()
    render(<SelectField aria-label="Site" value="" onValueChange={() => {}} options={PLANS} placeholder="Pick a site" disabled />)
    const trigger = screen.getByRole("combobox", { name: "Site" })
    expect(trigger).toHaveTextContent("Pick a site")
    await user.click(trigger)
    expect(screen.queryByRole("option")).not.toBeInTheDocument()
  })

  it("keeps the id and invalid state the form gave it", () => {
    render(<SelectField id="geo-type" aria-label="Type" aria-invalid value="Starter" onValueChange={() => {}} options={PLANS} />)
    const trigger = screen.getByRole("combobox", { name: "Type" })
    expect(trigger).toHaveAttribute("id", "geo-type")
    expect(trigger).toHaveAttribute("aria-invalid", "true")
  })
})

describe("Select parts", () => {
  it("renders grouped options under their headings", async () => {
    const user = userEvent.setup()
    render(
      <Select value="u1" onValueChange={() => {}}>
        <SelectTrigger aria-label="Applies to">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectGroupLabel>Admin units</SelectGroupLabel>
            <SelectItem value="u1">Finance</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectGroupLabel>Sites</SelectGroupLabel>
            <SelectItem value="s1">Malé central</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    )
    await open(user, "Applies to")
    expect(screen.getByText("Admin units")).toBeInTheDocument()
    expect(screen.getByText("Sites")).toBeInTheDocument()
    expect(screen.getAllByRole("option")).toHaveLength(2)
  })
})

import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PhotoDialog } from "@workspace/ui/components/photo-dialog"
import { ToastProvider } from "@workspace/ui/components/toast"

const choices = [
  { id: "portrait-1", url: "http://identity.bool.test/portraits/portrait-1.jpg", label: "Portrait 1" },
  { id: "portrait-2", url: "http://identity.bool.test/portraits/portrait-2.jpg", label: "Portrait 2" },
]

function renderDialog(current: string | undefined, onSave = vi.fn(async () => {}), onClose = vi.fn()) {
  render(
    <ToastProvider>
      <PhotoDialog open name="Aisha Ali" current={current} choices={choices} onSave={onSave} onClose={onClose} />
    </ToastProvider>,
  )
  return { onSave, onClose }
}

describe("PhotoDialog", () => {
  it("saves the chosen portrait by its id, then closes", async () => {
    const { onSave, onClose } = renderDialog(undefined)
    const save = screen.getByRole("button", { name: "Save" })
    expect(save).toBeDisabled() // nothing changed yet
    await userEvent.click(screen.getByTitle("Portrait 2"))
    await userEvent.click(save)
    expect(onSave).toHaveBeenCalledWith("portrait-2")
    expect(onClose).toHaveBeenCalled()
  })

  it("goes back to initials with an empty id", async () => {
    const { onSave } = renderDialog(choices[0].url)
    expect(screen.getByTitle("Portrait 1")).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(screen.getByTitle("Just my initials"))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onSave).toHaveBeenCalledWith("")
  })

  it("keeps a photo that is none of the choices (Google's) as the current option", async () => {
    renderDialog("https://lh3.googleusercontent.com/a/aisha")
    expect(screen.getByTitle("Your current photo")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("stays open when saving fails", async () => {
    const { onClose } = renderDialog(undefined, vi.fn(async () => Promise.reject(new Error("503"))))
    await userEvent.click(screen.getByTitle("Portrait 1"))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onClose).not.toHaveBeenCalled()
    expect(await screen.findByText("Your photo could not be saved. Try again shortly.", { selector: '[data-slot="toast"] *' })).toBeInTheDocument()
  })
})

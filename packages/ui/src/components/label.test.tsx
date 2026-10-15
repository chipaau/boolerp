import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { Label } from "@workspace/ui/components/label"

describe("Label", () => {
  it("marks a required field without changing the label's text", () => {
    render(
      <>
        <Label htmlFor="name" required>
          Name
        </Label>
        <input id="name" required />
        <Label htmlFor="note">Note</Label>
        <input id="note" />
      </>
    )
    expect(screen.getByLabelText("Name")).toBeRequired()
    expect(screen.getByText("Name")).toHaveAttribute("data-required", "true")
    expect(screen.getByText("Name").className).toContain("after:content-['*']")
    expect(screen.getByText("Note")).not.toHaveAttribute("data-required")
  })
})

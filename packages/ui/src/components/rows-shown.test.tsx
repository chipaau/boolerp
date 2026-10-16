import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { RowsShown } from "@workspace/ui/components/rows-shown"

describe("RowsShown", () => {
  it("names no noun, and drops Showing on a phone, so the footer stays one line (C219)", () => {
    const { container } = render(<RowsShown shown={25} total={249} limit={25} onLimit={() => {}} />)
    expect(container.textContent).toMatch(/^Showing.*of 249$/)
    expect(container.textContent).not.toMatch(/rows|items|countries/)
    expect(screen.getByText("Showing")).toHaveClass("hidden", "sm:inline")
    expect(screen.getByText("of 249")).not.toHaveClass("hidden")
  })

  it("shows the count without a choice when the list is short", () => {
    const { container } = render(<RowsShown shown={4} total={4} limit={25} onLimit={() => {}} />)
    expect(container.textContent).toBe("Showing4of 4")
  })
})

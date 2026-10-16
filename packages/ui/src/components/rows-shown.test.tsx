import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

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

  it("shows the count, not a choice, when every row fits on one page", () => {
    const { container } = render(<RowsShown shown={19} total={19} limit={25} onLimit={() => {}} />)
    expect(container.textContent).toBe("Showing19of 19")
    expect(screen.queryByRole("combobox", { name: "Rows to show" })).not.toBeInTheDocument()
  })

  it("offers the same page sizes whatever is chosen, the default 25 among them", async () => {
    const user = userEvent.setup()
    render(<RowsShown shown={25} total={249} limit={25} onLimit={() => {}} />)
    await user.click(screen.getByRole("combobox", { name: "Rows to show" }))
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent)
    expect(options).toEqual(["10", "20", "25", "50", "100", "All"])
  })

  it("asks for the page size chosen, and keeps it when the choice re-renders", async () => {
    const user = userEvent.setup()
    const onLimit = vi.fn()
    const { rerender } = render(<RowsShown shown={25} total={249} limit={25} onLimit={onLimit} />)
    await user.click(screen.getByRole("combobox", { name: "Rows to show" }))
    await user.click(await screen.findByRole("option", { name: "50" }))
    expect(onLimit).toHaveBeenCalledWith(50)
    rerender(<RowsShown shown={50} total={249} limit={50} onLimit={onLimit} />)
    expect(onLimit.mock.calls).toEqual([[50]])
    expect(screen.getByRole("combobox", { name: "Rows to show" })).toHaveTextContent("50")
  })

  it("groups the thousands, as the page's own count does", () => {
    const { container } = render(<RowsShown shown={5413} total={5413} limit={10000} onLimit={() => {}} />)
    expect(container.textContent).toBe("Showing5,413of 5,413")
  })
})

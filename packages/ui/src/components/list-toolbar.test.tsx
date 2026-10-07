import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

import { ListToolbar, SEARCH_DEBOUNCE_MS } from "@workspace/ui/components/list-toolbar"

afterEach(() => vi.useRealTimers())

describe("ListToolbar", () => {
  it("applies the search once typing settles", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    render(<ListToolbar search={{ value: undefined, onChange, placeholder: "Search tenants" }} />)
    const box = screen.getByLabelText("Search tenants")
    fireEvent.change(box, { target: { value: "cy" } })
    fireEvent.change(box, { target: { value: "cyryx " } })
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1))
    expect(onChange).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith("cyryx")

    fireEvent.change(box, { target: { value: "  " } })
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it("follows an outside change of the search", () => {
    const { rerender } = render(<ListToolbar search={{ value: "cy", onChange: vi.fn(), placeholder: "Search tenants" }} />)
    expect(screen.getByLabelText("Search tenants")).toHaveValue("cy")
    rerender(<ListToolbar search={{ value: undefined, onChange: vi.fn(), placeholder: "Search tenants" }} />)
    expect(screen.getByLabelText("Search tenants")).toHaveValue("")
  })

  it("shows declared filters as chips, a summary, and clears them", () => {
    const onStatus = vi.fn()
    const onClear = vi.fn()
    render(
      <ListToolbar
        filters={[
          {
            key: "status",
            label: "Status",
            type: "select",
            value: "active",
            onChange: onStatus,
            options: [
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
            ],
          },
        ]}
        onClear={onClear}
        summary="3 tenants"
      />
    )
    expect(screen.getByText("3 tenants")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Suspended" }))
    expect(onStatus).toHaveBeenCalledWith("suspended")
    fireEvent.click(screen.getByRole("button", { name: "All" }))
    expect(onStatus).toHaveBeenCalledWith(undefined)
    fireEvent.click(screen.getByText("Clear filters"))
    expect(onClear).toHaveBeenCalled()
  })

  it("offers no clearing when nothing is on", () => {
    render(<ListToolbar search={{ value: undefined, onChange: vi.fn(), placeholder: "Search" }} onClear={vi.fn()} />)
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument()
  })
})

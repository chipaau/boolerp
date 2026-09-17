import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { DatePicker } from "@workspace/ui/components/date-picker"

function Controlled({ initial = "", onChange }: { initial?: string; onChange?: (iso: string) => void }) {
  const [value, setValue] = React.useState(initial)
  return (
    <DatePicker
      aria-label="Date"
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange?.(v)
      }}
    />
  )
}

// the label is built by hand to the design's "Wed 30 Sep 2026" (Intl's en-GB would say "Wed, 30 Sept 2026")
const gb = (y: number, m: number, d: number) =>
  `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(y, m - 1, d).getDay()]} ${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`
const monthTitle = () => screen.getByText(/^[A-Z][a-z]+ \d{4}$/).textContent

describe("DatePicker", () => {
  afterEach(() => vi.useRealTimers())

  it("shows the placeholder when empty and a formatted label when set", () => {
    const { rerender } = render(<DatePicker aria-label="Date" value="" onChange={() => {}} placeholder="When?" />)
    expect(screen.getByRole("button", { name: "Date" })).toHaveTextContent("When?")
    rerender(<DatePicker aria-label="Date" value="2026-09-30" onChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Date" })).toHaveTextContent(gb(2026, 9, 30))
  })

  it("uses the default placeholder and honours disabled", () => {
    render(<DatePicker aria-label="Date" value="" onChange={() => {}} disabled />)
    const trigger = screen.getByRole("button", { name: "Date" })
    expect(trigger).toHaveTextContent("Pick a date")
    expect(trigger).toBeDisabled()
  })

  it("opens on the value's month, emits the picked ISO day and closes", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled initial="2026-09-30" onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: "Date" }))
    expect(monthTitle()).toBe("September 2026")
    await user.click(screen.getByRole("button", { name: "14" }))
    expect(onChange).toHaveBeenCalledWith("2026-09-14")
    expect(screen.queryByText("September 2026")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Date" })).toHaveTextContent(gb(2026, 9, 14))
  })

  it("navigates months across a year boundary", async () => {
    const user = userEvent.setup()
    render(<Controlled initial="2026-12-05" />)
    await user.click(screen.getByRole("button", { name: "Date" }))
    await user.click(screen.getByRole("button", { name: "Next month" }))
    expect(monthTitle()).toBe("January 2027")
    await user.click(screen.getByRole("button", { name: "Previous month" }))
    await user.click(screen.getByRole("button", { name: "Previous month" }))
    expect(monthTitle()).toBe("November 2026")
  })

  it("opens on the current month when empty", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 1, 3, 10))
    const user = userEvent.setup()
    render(<Controlled />)
    await user.click(screen.getByRole("button", { name: "Date" }))
    expect(monthTitle()).toBe("February 2026")
  })
})

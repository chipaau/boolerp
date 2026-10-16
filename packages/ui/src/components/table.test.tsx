import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import {
  Table,
  TableBody,
  TableBulkAction,
  TableBulkBar,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TableToolbar,
} from "@workspace/ui/components/table"

describe("TableBulkBar", () => {
  it("renders the label and pill actions, which fire their handlers", async () => {
    const onExport = vi.fn()
    render(
      <TableBulkBar label="3 selected" className="extra">
        <TableBulkAction onClick={onExport}>Export</TableBulkAction>
        <TableBulkAction emphasis>Archive</TableBulkAction>
      </TableBulkBar>
    )
    expect(screen.getByText("3 selected")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="table-bulk-bar"]')).toHaveClass("extra")
    const exportBtn = screen.getByRole("button", { name: "Export" })
    expect(exportBtn).toHaveAttribute("type", "button")
    expect(exportBtn).toHaveClass("bg-card/60")
    expect(screen.getByRole("button", { name: "Archive" })).toHaveClass("bg-card")
    await userEvent.click(exportBtn)
    expect(onExport).toHaveBeenCalledOnce()
  })
})

describe("Table parts", () => {
  it("render sort state, alignment, selection and the chrome around the table", () => {
    render(
      <>
        <TableToolbar>tools</TableToolbar>
        <Table>
          <TableCaption>People</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead sortable sorted="asc">Name</TableHead>
              <TableHead align="right" sorted="desc">Pay</TableHead>
              <TableHead align="center" sorted={false}>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow selected>
              <TableCell>Ali</TableCell>
              <TableCell align="right" numeric>10</TableCell>
              <TableCell align="center">On</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Aisha</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <TableFooter>2 people</TableFooter>
      </>
    )
    const [name, pay, status] = screen.getAllByRole("columnheader")
    expect(name).toHaveAttribute("aria-sort", "ascending")
    expect(name).toHaveTextContent("Name↑")
    expect(name).toHaveClass("cursor-pointer", "text-left")
    expect(pay).toHaveAttribute("aria-sort", "descending")
    expect(pay).toHaveTextContent("Pay↓")
    expect(status).not.toHaveAttribute("aria-sort")
    expect(status).toHaveClass("text-center")
    const [selected, plain] = screen.getAllByRole("row").slice(1)
    expect(selected).toHaveAttribute("data-state", "selected")
    expect(plain).not.toHaveAttribute("data-state")
    expect(screen.getByRole("cell", { name: "10" })).toHaveClass("tabular-nums", "text-right")
    expect(screen.getByText("People")).toBeInTheDocument()
    expect(screen.getByText("tools")).toBeInTheDocument()
    expect(screen.getByText("2 people")).toBeInTheDocument()
  })
})

describe("TablePagination", () => {
  it("marks the current page and moves between pages", async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<TablePagination page={2} pageCount={3} onPageChange={onPageChange} />)
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "1" })).not.toHaveAttribute("aria-current")
    await user.click(screen.getByRole("button", { name: "Previous page" }))
    await user.click(screen.getByRole("button", { name: "Next page" }))
    await user.click(screen.getByRole("button", { name: "3" }))
    expect(onPageChange.mock.calls).toEqual([[1], [3], [3]])
  })

  it("shows the first, the last, and the pages around the current one, with a gap for the rest", () => {
    const { rerender } = render(<TablePagination page={5} pageCount={10} onPageChange={() => {}} />)
    const pages = () => screen.queryAllByRole("button").map((b) => b.textContent).filter((t) => t && /^\d+$/.test(t))
    expect(pages()).toEqual(["1", "4", "5", "6", "10"])
    expect(screen.getAllByText("…")).toHaveLength(2)
    rerender(<TablePagination page={2} pageCount={10} onPageChange={() => {}} />)
    expect(pages()).toEqual(["1", "2", "3", "10"])
    rerender(<TablePagination page={3} pageCount={10} onPageChange={() => {}} />)
    expect(pages()).toEqual(["1", "2", "3", "4", "10"], "a single page between is shown, not a gap")
    rerender(<TablePagination page={2} pageCount={4} onPageChange={() => {}} />)
    expect(pages()).toEqual(["1", "2", "3", "4"])
    expect(screen.queryByText("…")).not.toBeInTheDocument()
  })

  it("says which page of how many, for a phone where the page buttons are hidden", () => {
    render(<TablePagination page={3} pageCount={10} onPageChange={() => {}} />)
    expect(screen.getByText("Page 3 of 10")).toBeInTheDocument()
    expect(screen.getByText("3 / 10")).toHaveAttribute("aria-hidden", "true")
  })

  it("disables the arrows at either end", () => {
    const { rerender } = render(<TablePagination page={1} pageCount={2} onPageChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled()
    rerender(<TablePagination page={2} pageCount={2} onPageChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  })
})

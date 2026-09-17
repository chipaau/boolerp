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

  it("disables the arrows at either end", () => {
    const { rerender } = render(<TablePagination page={1} pageCount={2} onPageChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled()
    rerender(<TablePagination page={2} pageCount={2} onPageChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  })
})

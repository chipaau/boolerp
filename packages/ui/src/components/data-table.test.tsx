import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { DataTable, type DataTableColumn, formatSort, parseSort } from "@workspace/ui/components/data-table"

type Row = { id: string; name: string; code: string }
const rows: Row[] = [
  { id: "1", name: "Alpha", code: "ALP" },
  { id: "2", name: "Bravo", code: "BRV" },
]
const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Name", accessorKey: "name", enableSorting: true },
  { id: "code", header: "Code", accessorKey: "code", enableSorting: false, meta: { wide: true, align: "right" } },
]

type Props = React.ComponentProps<typeof DataTable<Row>>

function setup(props: Partial<Props> = {}) {
  const handlers = { onSortChange: vi.fn(), onPageChange: vi.fn(), onPageSizeChange: vi.fn(), onRowClick: vi.fn() }
  render(
    <DataTable<Row>
      columns={columns}
      data={rows}
      total={2}
      page={1}
      pageSize={25}
      getRowId={(r) => r.id}
      empty={{ title: "No tenants yet" }}
      noun="tenants"
      {...handlers}
      {...props}
    />
  )
  return handlers
}

describe("sort strings", () => {
  it("round-trip the API's sort parameter", () => {
    expect(parseSort("-name,code")).toEqual([
      { id: "name", desc: true },
      { id: "code", desc: false },
    ])
    expect(parseSort(undefined)).toEqual([])
    expect(formatSort([{ id: "name", desc: true }])).toBe("-name")
    expect(formatSort([])).toBeUndefined()
  })
})

describe("DataTable", () => {
  it("renders the rows and opens one on click", async () => {
    const h = setup()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("ALP").closest("td")).toHaveClass("max-lg:hidden")
    await userEvent.click(screen.getByText("Bravo"))
    expect(h.onRowClick).toHaveBeenCalledWith(rows[1])
  })

  it("sorts through the API: a sortable header reports the next sort", async () => {
    const h = setup()
    await userEvent.click(screen.getByText("Name"))
    expect(h.onSortChange).toHaveBeenLastCalledWith("name")
    await userEvent.click(screen.getByText("Code"))
    expect(h.onSortChange).toHaveBeenCalledTimes(1)
  })

  it("shows the current sort and reports the reverse, also from the keyboard", async () => {
    const h = setup({ sort: "name" })
    const header = screen.getByText("Name").closest("th") as HTMLElement
    expect(header).toHaveAttribute("aria-sort", "ascending")
    fireEvent.keyDown(header, { key: "Enter" })
    expect(h.onSortChange).toHaveBeenLastCalledWith("-name")
  })

  it("pages and sizes through the API", async () => {
    const h = setup({ total: 60, pageSize: 25 })
    await userEvent.click(within(screen.getByRole("navigation", { name: "Pagination" })).getByText("3"))
    expect(h.onPageChange).toHaveBeenCalledWith(3)
  })

  it("shows a skeleton on the first load", () => {
    setup({ data: undefined, isLoading: true })
    expect(screen.getAllByTestId("data-table-skeleton").length).toBeGreaterThan(0)
  })

  it("shows a refresh indicator while refetching shown data", () => {
    setup({ isFetching: true })
    expect(screen.getByLabelText("Refreshing")).toBeInTheDocument()
  })

  it("tells an empty list from one where nothing matches", async () => {
    setup({ data: [], total: 0 })
    expect(screen.getByText("No tenants yet")).toBeInTheDocument()
  })

  it("offers to clear filters when nothing matches", async () => {
    const onClearFilters = vi.fn()
    setup({ data: [], total: 0, filtered: true, onClearFilters })
    expect(screen.getByText("No tenants match these filters")).toBeInTheDocument()
    await userEvent.click(screen.getByText("Clear filters"))
    expect(onClearFilters).toHaveBeenCalled()
  })

  it("shows a 403 on the first load as a forbidden state", () => {
    setup({ data: undefined, error: { message: "Forbidden", forbidden: true } })
    expect(screen.getByText("You don't have access to this")).toBeInTheDocument()
  })

  it("shows other first-load errors with the reference and a retry", async () => {
    const onRetry = vi.fn()
    setup({ data: undefined, error: { message: "The service could not be reached.", requestId: "req-1" }, onRetry })
    expect(screen.getByText("Reference: req-1")).toBeInTheDocument()
    await userEvent.click(screen.getByText("Try again"))
    expect(onRetry).toHaveBeenCalled()
  })

  it("keeps shown data when a refresh fails (the error policy toasts it)", () => {
    setup({ error: { message: "The service could not be reached." } })
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.queryByText("This list couldn't be loaded")).not.toBeInTheDocument()
  })
})

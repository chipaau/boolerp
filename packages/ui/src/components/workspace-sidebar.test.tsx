import * as React from "react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { House, LifeBuoy } from "lucide-react"

import { SidebarProvider } from "@workspace/ui/components/sidebar"
import { SidebarAttention, SidebarSection, WorkspaceSidebar } from "@workspace/ui/components/workspace-sidebar"
import type { SidebarNavItem } from "@workspace/ui/components/workspace-sidebar"

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})

const identity = { glyph: <span>G</span>, name: "Admin", description: "Tenants, billing and access" }

function wrap(ui: React.ReactNode, open = true) {
  return render(<SidebarProvider defaultOpen={open}>{ui}</SidebarProvider>)
}

describe("WorkspaceSidebar", () => {
  it("renders identity, groups, active row and counts", () => {
    const items: SidebarNavItem[] = [
      { key: "home", title: "Home", icon: House, render: <a href="/" />, active: true, count: 0, countTone: "warning" },
      { key: "dot", title: "Dotted", icon: <i data-testid="dot" />, render: <a href="/d" />, count: 3, countTone: "risk", countLabel: "3 at risk" },
      { key: "warn", title: "Warn", render: <a href="/w" />, count: 2, countTone: "warning" },
      { key: "plain", title: "Plain", render: <a href="/p" />, countTone: "risk" },
    ]
    wrap(<WorkspaceSidebar identity={identity} groups={[{ items }, { title: "More", items: [{ key: "m", title: "More row", render: <a href="/m" /> }] }]} />)
    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(screen.getByText("Tenants, billing and access")).toBeInTheDocument()
    expect(screen.getByText("More")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("data-active")
    expect(screen.getByRole("link", { name: /Plain/ })).not.toHaveAttribute("data-active")
    expect(screen.getByTestId("dot")).toBeInTheDocument()
    expect(screen.getByLabelText("3 at risk")).toHaveClass("bg-tone-risk-soft")
    expect(screen.getByText("2")).toHaveClass("bg-tone-warning-soft")
    // zero stays quiet even with a tone
    expect(screen.getByText("0")).not.toHaveClass("bg-tone-warning-soft")
    // icon-less rows carry an initial for the folded rail
    expect(document.querySelectorAll('[data-slot="nav-initial"]')).toHaveLength(3)
    expect(document.querySelector('[data-slot="sidebar-footer"]')).toBeNull()
  })

  it("renders footer actions and the maker's mark", async () => {
    const onClick = vi.fn()
    wrap(<WorkspaceSidebar identity={{ glyph: "G", name: "App" }} footer={{ actions: [{ label: "Support", icon: LifeBuoy, onClick }], madeBy: { href: "https://bool.mv" } }} />)
    await userEvent.click(screen.getByRole("button", { name: "Support" }))
    expect(onClick).toHaveBeenCalled()
    expect(screen.getByRole("link", { name: /Built by Bool/ })).toHaveAttribute("href", "https://bool.mv")
  })

  it("renders a footer with neither actions nor mark", () => {
    wrap(<WorkspaceSidebar identity={identity} footer={{ actions: [] }} className="x" />)
    expect(document.querySelector('[data-slot="sidebar-footer"]')).toBeInTheDocument()
  })

  it("expands and collapses tree rows", async () => {
    function Tree() {
      const [open, setOpen] = React.useState(false)
      const items: SidebarNavItem[] = [
        { key: "p", title: "Parent", render: <button type="button" />, open, onOpenChange: setOpen, items: [{ key: "c", title: "Child", render: <button type="button" />, items: [] }] },
        { key: "leaf", title: "Leaf", render: <button type="button" />, items: [] },
        { key: "bare", title: "Bare", render: <button type="button" /> },
      ]
      return <WorkspaceSidebar identity={identity} groups={[{ items }]} />
    }
    wrap(<Tree />)
    expect(screen.queryByText("Child")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Expand Parent" }))
    expect(screen.getByText("Child")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Collapse Parent" }))
    expect(screen.queryByText("Child")).toBeNull()
    // a row without a toggle handler does nothing
    await userEvent.click(screen.getByRole("button", { name: "Expand Bare" }))
    expect(screen.getByRole("button", { name: "Expand Leaf" })).toHaveClass("invisible")
  })
})

describe("SidebarSection", () => {
  it("shows title, action and content when open", () => {
    wrap(
      <WorkspaceSidebar identity={identity}>
        <SidebarSection title="My calendars" action={<button type="button">Manage</button>} collapsed={<span>folded</span>}>
          <p>content</p>
        </SidebarSection>
        <SidebarSection action={<span>only action</span>}>x</SidebarSection>
        <SidebarSection>bare</SidebarSection>
      </WorkspaceSidebar>
    )
    expect(screen.getByText("My calendars")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Manage" })).toBeInTheDocument()
    expect(screen.getByText("content")).toBeInTheDocument()
    expect(screen.getByText("only action")).toBeInTheDocument()
    expect(screen.queryByText("folded")).toBeNull()
  })

  it("shows the collapsed slot, or nothing, when folded", () => {
    wrap(
      <WorkspaceSidebar identity={identity}>
        <SidebarSection title="With" collapsed={<span>folded</span>}>
          <p>content</p>
        </SidebarSection>
        <SidebarSection title="Without">
          <p>gone</p>
        </SidebarSection>
      </WorkspaceSidebar>,
      false
    )
    expect(screen.getByText("folded")).toBeInTheDocument()
    expect(screen.queryByText("content")).toBeNull()
    expect(screen.queryByText("gone")).toBeNull()
  })
})

describe("SidebarAttention", () => {
  it("lists toned rows with counts", async () => {
    const onClick = vi.fn()
    wrap(
      <WorkspaceSidebar identity={identity}>
        <SidebarAttention
          items={[
            { key: "a", label: "Overdue invoices", count: 4, tone: "risk", render: <button type="button" onClick={onClick} /> },
            { key: "b", label: "Trials ending", count: 2, tone: "warning", render: <button type="button" /> },
            { key: "c", label: "Drafts", count: 1, tone: "caution", render: <button type="button" /> },
            { key: "d", label: "Idle", count: 5, tone: "neutral", render: <button type="button" /> },
          ]}
        />
      </WorkspaceSidebar>
    )
    expect(screen.getByText("Needs attention")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Overdue invoices/ }))
    expect(onClick).toHaveBeenCalled()
    expect(screen.getByText("4")).toHaveClass("bg-tone-risk-soft")
    expect(screen.getByText("2")).toHaveClass("bg-tone-warning-soft")
    expect(screen.getByText("1")).not.toHaveClass("bg-tone-warning-soft")
  })

  it("shows the empty line", () => {
    wrap(
      <WorkspaceSidebar identity={identity}>
        <SidebarAttention title="To do" items={[]} />
        <SidebarAttention items={[]} empty="All clear" />
      </WorkspaceSidebar>
    )
    expect(screen.getByText("To do")).toBeInTheDocument()
    expect(screen.getByText("Nothing needs a look right now.")).toBeInTheDocument()
    expect(screen.getByText("All clear")).toBeInTheDocument()
  })
})

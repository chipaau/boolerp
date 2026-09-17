import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { NotificationsBell } from "@workspace/ui/components/notifications-bell"

const items = [
  { id: "a", title: "First", time: "09:00", category: "Billing", unread: true },
  { id: "b", title: "Second", unread: false },
  { id: "c", title: "Third", category: "Tenants", unread: false },
  { id: "d", title: "Fourth", unread: false },
]

describe("NotificationsBell", () => {
  it("shows the unread dot, lists the recent items with category and time, and fires callbacks", async () => {
    const onMarkAllRead = vi.fn()
    const onItemClick = vi.fn()
    const { container } = render(
      <NotificationsBell
        items={items}
        onMarkAllRead={onMarkAllRead}
        onItemClick={onItemClick}
        renderItem={(n) => <a href={`#${n.id}`} />}
        seeAll={<a href="#all" />}
        preferences={<a href="#prefs" />}
      />
    )
    expect(container.querySelector('[data-slot="unread-dot"]')).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }))
    expect(await screen.findByText("First")).toBeInTheDocument()
    expect(screen.getByText("Billing")).toBeInTheDocument()
    expect(screen.getByText("09:00")).toBeInTheDocument()
    expect(screen.getByText("Tenants")).toBeInTheDocument()
    expect(screen.queryByText("Fourth")).not.toBeInTheDocument()
    expect(screen.getByText("See all notifications")).toHaveAttribute("href", "#all")
    expect(screen.getByText("Preferences")).toHaveAttribute("href", "#prefs")
    await userEvent.click(screen.getByText("Mark all read"))
    expect(onMarkAllRead).toHaveBeenCalled()
    await userEvent.click(screen.getByText("Second"))
    expect(onItemClick).toHaveBeenCalledWith(items[1])
  })

  it("hides categories when asked, keeps only preferences, and survives no item callback", async () => {
    const { container } = render(
      <NotificationsBell items={items.slice(1)} showCategory={false} onMarkAllRead={() => {}} preferences={<a href="#prefs" />} />
    )
    expect(container.querySelector('[data-slot="unread-dot"]')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }))
    expect(await screen.findByText("Third")).toBeInTheDocument()
    expect(screen.queryByText("Tenants")).not.toBeInTheDocument()
    expect(screen.queryByText("See all notifications")).not.toBeInTheDocument()
    expect(screen.getByText("Preferences")).toBeInTheDocument()
    await userEvent.click(screen.getByText("Second"))
  })

  it("shows the empty text and no footer without links", async () => {
    render(<NotificationsBell items={[]} limit={5} emptyText="All clear" onMarkAllRead={() => {}} />)
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }))
    expect(await screen.findByText("All clear")).toBeInTheDocument()
    expect(screen.queryByText("Preferences")).not.toBeInTheDocument()
  })
})

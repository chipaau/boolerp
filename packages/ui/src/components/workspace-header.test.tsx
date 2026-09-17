import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import {
  AccountMenu,
  AppSwitcherMenu,
  BrandMark,
  HeaderDivider,
  HeaderSearchTrigger,
  ThemeToggle,
  WorkspaceHeader,
} from "@workspace/ui/components/workspace-header"
import { THEME_STORAGE_KEY } from "@workspace/ui/hooks/use-theme"

function mockMatchMedia(dark: boolean) {
  window.matchMedia = ((q: string) => ({ matches: dark, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove("dark")
  mockMatchMedia(false)
})
afterEach(() => vi.restoreAllMocks())

describe("WorkspaceHeader", () => {
  it("renders the three slots in a sticky header", () => {
    render(<WorkspaceHeader brand={<span>brand</span>} search={<span>search</span>} actions={<HeaderDivider />} className="extra" />)
    const header = screen.getByRole("banner")
    expect(header).toHaveClass("sticky", "grid", "bg-card", "extra")
    expect(screen.getByText("brand")).toBeInTheDocument()
    expect(screen.getByText("search")).toBeInTheDocument()
    expect(header.querySelector('[data-slot="header-divider"]')).toBeInTheDocument()
  })
})

describe("BrandMark", () => {
  it("defaults to an anchor home with Bool", () => {
    render(<BrandMark logoSrc="/logo.png" />)
    const link = screen.getByRole("link", { name: "Bool" })
    expect(link).toHaveAttribute("href", "/")
    expect(link.querySelector("img")).toHaveAttribute("src", "/logo.png")
  })
  it("uses the render element and name", () => {
    render(<BrandMark logoSrc="/l.png" name="Other" render={<a href="/home" />} />)
    expect(screen.getByRole("link", { name: "Other" })).toHaveAttribute("href", "/home")
  })
})

describe("ThemeToggle", () => {
  it("switches and persists", async () => {
    render(<ThemeToggle />)
    const btn = screen.getByRole("button", { name: "Switch to dark mode" })
    await userEvent.click(btn)
    expect(document.documentElement).toHaveClass("dark")
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark")
    await userEvent.click(screen.getByRole("button", { name: "Switch to light mode" }))
    expect(document.documentElement).not.toHaveClass("dark")
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light")
  })
  it("reads a saved theme", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark")
    render(<ThemeToggle />)
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument()
  })
  it("falls back to the system preference and survives storage failures", async () => {
    mockMatchMedia(true)
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole("button", { name: "Switch to light mode" }))
    expect(set).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument()
  })
  it("treats an unknown saved value as unset", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia")
    render(<ThemeToggle />)
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument()
  })
})

describe("HeaderSearchTrigger", () => {
  it("opens on click and on the shortcut", async () => {
    const onOpen = vi.fn()
    const { unmount } = render(<HeaderSearchTrigger onOpen={onOpen} />)
    await userEvent.click(screen.getByRole("button", { name: "Search" }))
    expect(screen.getByText("⌘K")).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "k", metaKey: true })
    fireEvent.keyDown(window, { key: "K", ctrlKey: true })
    fireEvent.keyDown(window, { key: "k" })
    expect(onOpen).toHaveBeenCalledTimes(3)
    unmount()
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    expect(onOpen).toHaveBeenCalledTimes(3)
  })
  it("takes a placeholder", () => {
    render(<HeaderSearchTrigger onOpen={() => {}} placeholder="Find" />)
    expect(screen.getByRole("button", { name: "Find" })).toBeInTheDocument()
  })
})

describe("AppSwitcherMenu", () => {
  it("lists apps with the active one marked, and a footer", async () => {
    render(
      <AppSwitcherMenu
        items={[
          { key: "a", name: "Alpha", icon: <i />, render: <a href="/a" />, active: true },
          { key: "b", name: "Beta", icon: <i />, render: <a href="/b" /> },
        ]}
        footer={<span>Browse</span>}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Switch app" }))
    expect(await screen.findByText("Apps")).toBeInTheDocument()
    expect(screen.getByText("Alpha").closest("a")).toHaveAttribute("aria-current", "page")
    expect(screen.getByText("Alpha")).toHaveClass("text-tone-warning-deep")
    expect(screen.getByText("Beta").closest("a")).not.toHaveAttribute("aria-current")
    expect(screen.getByText("Browse")).toBeInTheDocument()
  })
  it("omits the footer when none is given", async () => {
    render(<AppSwitcherMenu items={[]} />)
    await userEvent.click(screen.getByRole("button", { name: "Switch app" }))
    expect(await screen.findByText("Apps")).toBeInTheDocument()
    expect(document.querySelector(".border-divider")).toBeNull()
  })
})

describe("AccountMenu", () => {
  it("shows the user and runs item actions", async () => {
    const onSignOut = vi.fn()
    render(
      <AccountMenu
        user={{ name: "Aisha Ali", email: "aisha@example.mv" }}
        avatarSrc="/a.png"
        items={[
          { key: "p", label: "Profile" },
          { key: "s", label: "Sign out", destructive: true, onClick: onSignOut },
        ]}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Aisha Ali. Account menu" }))
    expect(await screen.findByText("aisha@example.mv")).toBeInTheDocument()
    expect(screen.getByText("Profile")).not.toHaveClass("text-tone-risk-foreground")
    const signOut = screen.getByText("Sign out")
    expect(signOut).toHaveClass("text-tone-risk-foreground")
    await userEvent.click(signOut)
    expect(onSignOut).toHaveBeenCalled()
  })
})

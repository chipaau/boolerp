import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { LinkTab, LinkTabs, Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

const indicator = () => document.querySelector<HTMLElement>('[data-slot="link-tabs"] [data-slot="tabs-indicator"]')!

describe("Tabs", () => {
  it("switches panels on click", async () => {
    const user = userEvent.setup()
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Alpha</TabsTrigger>
          <TabsTrigger value="b">Beta</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>
    )
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Panel A")).toBeVisible()
    await user.click(screen.getByRole("tab", { name: "Beta" }))
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Panel B")).toBeVisible()
    expect(screen.queryByText("Panel A")).not.toBeInTheDocument()
  })
})

describe("LinkTabs", () => {
  it("marks the active item and positions the indicator under it", () => {
    const rect = (left: number, width: number) => ({ left, width, top: 0, right: left + width, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.dataset.slot === "link-tabs" ? rect(10, 300) : rect(60, 40)
    })
    render(
      <LinkTabs aria-label="Views">
        <LinkTab>One</LinkTab>
        <LinkTab active>Two</LinkTab>
        <LinkTab disabled>Three</LinkTab>
      </LinkTabs>
    )
    const two = screen.getByRole("button", { name: "Two" })
    expect(two).toHaveAttribute("aria-current", "page")
    expect(two).toHaveAttribute("data-active")
    expect(two).toHaveAttribute("type", "button")
    expect(screen.getByRole("button", { name: "One" })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("button", { name: "Three" })).toHaveAttribute("aria-disabled", "true")
    expect(indicator()).not.toHaveClass("hidden")
    expect(indicator().style.getPropertyValue("--active-tab-left")).toBe("50px")
    expect(indicator().style.getPropertyValue("--active-tab-width")).toBe("40px")
    spy.mockRestore()
  })

  it("hides the indicator when nothing is active, and follows changes", async () => {
    function Switcher() {
      const [on, setOn] = React.useState<string | null>(null)
      return (
        <LinkTabs>
          {["x", "y"].map((k) => (
            <LinkTab key={k} active={on === k} onClick={() => setOn(k)}>
              {k}
            </LinkTab>
          ))}
        </LinkTabs>
      )
    }
    const { unmount } = render(<Switcher />)
    expect(indicator()).toHaveClass("hidden")
    await act(async () => {
      screen.getByRole("button", { name: "y" }).click()
      await new Promise((r) => setTimeout(r, 0)) // let the MutationObserver fire
    })
    expect(screen.getByRole("button", { name: "y" })).toHaveAttribute("data-active")
    expect(indicator()).not.toHaveClass("hidden")
    unmount()
  })

  it("renders a custom element and omits the button type", () => {
    render(
      <LinkTabs>
        <LinkTab active render={<a href="/people" />}>People</LinkTab>
      </LinkTabs>
    )
    const link = screen.getByRole("link", { name: "People" })
    expect(link).toHaveAttribute("aria-current", "page")
    expect(link).not.toHaveAttribute("type")
  })
})

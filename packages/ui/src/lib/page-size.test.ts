import { afterEach, describe, expect, it, vi } from "vitest"

import { rememberPageSize, rememberedPageSize } from "@workspace/ui/lib/page-size"

afterEach(() => vi.unstubAllGlobals())

describe("the remembered page size (C222)", () => {
  it("is the last size chosen, for every list, and the fallback until one is", () => {
    expect(rememberedPageSize(25)).toBe(25)
    rememberPageSize(50)
    expect(rememberedPageSize(25)).toBe(50)
    expect(rememberedPageSize(10), "whatever the list's own default").toBe(50)
  })

  it("ignores what no list could ask for", () => {
    rememberPageSize(0)
    rememberPageSize(101)
    rememberPageSize(2.5)
    expect(rememberedPageSize(25)).toBe(25)
    localStorage.setItem("bool:list:page-size", "lots")
    expect(rememberedPageSize(25)).toBe(25)
  })

  it("falls back when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    })
    expect(() => rememberPageSize(50)).not.toThrow()
    expect(rememberedPageSize(25)).toBe(25)
  })
})

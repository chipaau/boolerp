// The page size a viewer last chose, remembered in this browser (C222), so every list in the app
// opens at it when its URL names none; the URL still wins (C174). A per-viewer convenience: in a
// private window, or with storage blocked or cleared, lists fall back to their own default.

const KEY = "bool:list:page-size"
const MAX = 100 // the API's largest page (C68)

const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX

/** The page size this browser remembers, or `fallback` when it remembers none. */
export function rememberedPageSize(fallback: number): number {
  try {
    const n = Number(globalThis.localStorage?.getItem(KEY))
    return valid(n) ? n : fallback
  } catch {
    return fallback
  }
}

/** Remembers a page size the viewer chose, for every list in the app. */
export function rememberPageSize(size: number): void {
  if (!valid(size)) return
  try {
    globalThis.localStorage?.setItem(KEY, String(size))
  } catch {
    // Storage blocked: the choice still applies to this list, only not to the next.
  }
}

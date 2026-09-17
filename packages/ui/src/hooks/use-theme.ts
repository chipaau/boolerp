import { useCallback, useEffect, useState } from "react"

export type Theme = "light" | "dark"

/** The localStorage key every app shares, so a choice made in one carries to the others. */
export const THEME_STORAGE_KEY = "erp-theme"

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark")
}

function readSaved(): Theme | null {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY)
    return v === "dark" || v === "light" ? v : null
  } catch {
    return null
  }
}

/**
 * Light/dark preference. The initial theme is applied by an inline script in each app's index.html
 * to avoid a flash; this keeps React state in sync and persists the choice. Storage failures
 * (private mode, blocked site data) fall back to the system preference and are otherwise ignored.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light")

  useEffect(() => {
    const saved = readSaved() ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    setThemeState(saved)
    applyTheme(saved)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // the choice still applies for this page
    }
    applyTheme(next)
  }, [])

  return { theme, setTheme, isDark: theme === "dark" }
}

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'goerp-theme'

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

/**
 * Light/dark preference, same convention as apps/app's useTheme (same localStorage key, so a
 * choice made in one carries to the other — both share one cookie-domain browser).
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const saved =
      (localStorage.getItem(KEY) as Theme | null) ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setThemeState(saved)
    applyTheme(saved)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    localStorage.setItem(KEY, next)
    applyTheme(next)
  }, [])

  return { theme, setTheme, isDark: theme === 'dark' }
}

// ARCHIVED — not imported anywhere. See README.md in this folder.
import { useEffect } from 'react'
import { APPS } from '@/lib/apps'

/** The CSS class that themed an app accent colour (see app-themes.css). */
export function appThemeClass(slug: string): string {
  return `theme-${slug}`
}

const ALL_THEME_CLASSES = APPS.map((a) => appThemeClass(a.slug))

// Sets the active app's accent theme on <html> (removing any other app theme), so the primary
// colour cascades to the whole shell — header, sidebar, and content.
export function useAppTheme(slug: string) {
  useEffect(() => {
    const el = document.documentElement
    el.classList.remove(...ALL_THEME_CLASSES)
    el.classList.add(appThemeClass(slug))
    return () => el.classList.remove(appThemeClass(slug))
  }, [slug])
}

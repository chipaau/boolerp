import { useEffect } from 'react'
import { APPS, appThemeClass } from '@/lib/apps'

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

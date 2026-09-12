import { Button } from '@workspace/ui/components/button'
import { useTheme } from './use-theme'

// The design's 34px round icon button: a sun in dark mode, a moon in light. Identical to apps/app's.
const MOON = 'M15.5 12.4A6 6 0 017.6 4.5 6.4 6.4 0 1015.5 12.4z'
const SUN =
  'M10 3.2v1.6M10 15.2v1.6M3.2 10h1.6M15.2 10h1.6M5.4 5.4l1.1 1.1M13.5 13.5l1.1 1.1M14.6 5.4l-1.1 1.1M6.5 13.5l-1.1 1.1M13 10a3 3 0 11-6 0 3 3 0 016 0z'

export function ThemeToggle() {
  const { isDark, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-[34px] text-muted-foreground hover:bg-sidebar-hover"
      title={isDark ? 'Light mode' : 'Dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-[17px]">
        <path d={isDark ? SUN : MOON} />
      </svg>
    </Button>
  )
}

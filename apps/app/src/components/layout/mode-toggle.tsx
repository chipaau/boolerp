import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'

type Theme = 'light' | 'dark'
const KEY = 'goerp-theme'

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

// Light/dark toggle. The initial theme is applied by an inline script in index.html to avoid a flash;
// this keeps React state in sync and persists the choice.
export function ModeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const saved =
      (localStorage.getItem(KEY) as Theme | null) ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setTheme(saved)
    applyTheme(saved)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem(KEY, next)
    applyTheme(next)
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="text-muted-foreground">
      {theme === 'dark' ? (
        <Sun className="size-[18px]" strokeWidth={1.75} />
      ) : (
        <Moon className="size-[18px]" strokeWidth={1.75} />
      )}
    </Button>
  )
}

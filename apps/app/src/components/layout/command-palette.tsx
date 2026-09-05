import { useEffect, useState  } from 'react'
import type {ReactNode} from 'react';
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Moon, Sun } from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@workspace/ui/components/command'
import { SearchField } from '@workspace/ui/components/search-field'
import { AppIcon } from '@/components/app-icon'
import { fmtRange, shortDate } from '@/features/calendar/logic'
import { meetingsQuery } from '@/features/calendar/queries'
import { APPS } from '@/lib/apps'
import { useTheme } from './use-theme'

/**
 * The workspace search (⌘K): every app and every section of every app, plus a couple of
 * commands. Picking a row navigates. Files and people join once the API exposes them.
 */
export function CommandPalette({ trigger }: { trigger?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { isDark, setTheme } = useTheme()
  // meetings join the index once loaded; the header never waits on them
  const meetings = useQuery(meetingsQuery()).data ?? []

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function go(to: () => void) {
    setOpen(false)
    to()
  }

  return (
    <>
      <SearchField
        asButton
        size="sm"
        placeholder="Search"
        shortcut={<span className="text-micro font-medium tracking-[0.04em] text-muted-foreground">⌘K</span>}
        className="justify-self-center"
        onClick={() => setOpen(true)}
      />
      {trigger}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Search apps, pages, people…" shortcut="esc" autoFocus />
          <CommandList>
            <CommandEmpty>Nothing matches that yet.</CommandEmpty>
            <CommandGroup heading="Apps">
              {APPS.map((app) => (
                <CommandItem
                  key={app.slug}
                  value={`${app.name} ${app.description}`}
                  onSelect={() => go(() => navigate({ to: '/$app', params: { app: app.slug } }))}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-surface-soft">
                    <AppIcon slug={app.slug} size={18} />
                  </span>
                  <span className="font-bold text-foreground">{app.name}</span>
                  <span className="truncate text-caption text-muted-foreground">{app.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {APPS.flatMap((app) =>
                app.menu.flatMap((section) =>
                  section.items
                    .filter((item) => item.slug)
                    .map((item) => (
                      <CommandItem
                        key={`${app.slug}/${item.slug}/${item.title}`}
                        value={`${app.name} ${item.title}`}
                        onSelect={() =>
                          go(() =>
                            navigate({
                              to: '/$app/$section',
                              params: { app: app.slug, section: item.slug },
                              search: item.search,
                            })
                          )
                        }
                      >
                        {item.icon ? <item.icon strokeWidth={1.75} /> : <ArrowRight strokeWidth={1.75} />}
                        <span className="text-foreground">{item.title}</span>
                        <span className="text-caption text-muted-foreground">{app.name}</span>
                      </CommandItem>
                    ))
                )
              )}
            </CommandGroup>
            {meetings.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Meetings">
                  {meetings.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={`${m.title} ${m.room} ${m.date}`}
                      onSelect={() => go(() => navigate({ to: '/$app/$section', params: { app: 'calendar', section: 'meetings' }, search: { id: m.id } }))}
                    >
                      <CalendarDays strokeWidth={1.75} />
                      <span className="text-foreground">{m.title}</span>
                      <span className="truncate text-caption text-muted-foreground">
                        {shortDate(m.date)} · {fmtRange(m.start, m.end)} · {m.room}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            <CommandSeparator />
            <CommandGroup heading="Commands">
              <CommandItem value="toggle theme dark light mode" onSelect={() => go(() => setTheme(isDark ? 'light' : 'dark'))}>
                {isDark ? <Sun strokeWidth={1.75} /> : <Moon strokeWidth={1.75} />}
                <span className="text-foreground">{isDark ? 'Switch to light mode' : 'Switch to dark mode'}</span>
                <CommandShortcut>⌘K then T</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

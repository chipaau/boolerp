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
import { useTheme } from '@workspace/ui/hooks/use-theme'
import { AppIcon } from '@/components/app-icon'
import { fmtRange, shortDate } from '@/features/calendar/logic'
import { meetingsQuery } from '@/features/calendar/queries'
import { APPS } from '@/lib/apps'

/**
 * The workspace search (⌘K): every app and every section of every app, plus a couple of
 * commands. Picking a row navigates. Opened by the shared HeaderSearchTrigger (click or ⌘K). Files and people join once the API exposes them.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const { isDark, setTheme } = useTheme()
  // meetings join the index once loaded; the header never waits on them
  const meetings = useQuery(meetingsQuery()).data ?? []
  const setOpen = onOpenChange

  function go(to: () => void) {
    setOpen(false)
    to()
  }

  return (
    <>
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

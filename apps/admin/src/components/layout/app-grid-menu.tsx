import { Button } from '@workspace/ui/components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@workspace/ui/components/dropdown-menu'
import { cn } from '@workspace/ui/lib/utils'
import { workspaceUrl } from '@/lib/workspace-url'

// The design's six app plates. Colours are the design's per-app hues mapped onto tone tokens.
const APPS = [
  { name: 'Inventory', path: '/inventory', plate: 'bg-tone-tan' },
  { name: 'Directory', path: '/directory', plate: 'bg-tone-success' },
  { name: 'Calendar', path: '/calendar', plate: 'bg-tone-plum' },
  { name: 'Scan', path: '/scan', plate: 'bg-tone-slate' },
  { name: 'Control', path: '/control-centre', plate: 'bg-tone-rose' },
  { name: 'Admin', path: null, plate: 'bg-surface-inverted' },
] as const

/** The 3×3-dots button and its apps grid. Every app but Admin opens the tenant workspace in place. */
export function AppGridMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-[34px] hover:bg-sidebar-hover data-open:bg-sidebar-hover"
            aria-label="Switch app"
            title="Switch app"
          />
        }
      >
        <span aria-hidden="true" className="grid grid-cols-3 gap-[3.5px]">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="size-[3px] rounded-full bg-faint" />
          ))}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[270px] p-3">
        <div className="px-2 pt-1 pb-2.5 text-overline text-faint">Apps</div>
        <div className="grid grid-cols-3 gap-1">
          {APPS.map((app) => (
            <a
              key={app.name}
              href={app.path ? workspaceUrl(app.path) : '/'}
              aria-current={app.path ? undefined : 'page'}
              className="flex flex-col items-center gap-2 rounded-[10px] px-1.5 py-3 text-center outline-none transition-colors duration-instant ease-bool hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true" className={cn('size-[30px] rounded-[9px]', app.plate)} />
              <span className={cn('text-fine font-bold', app.path ? 'text-body' : 'text-tone-warning-deep')}>{app.name}</span>
            </a>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

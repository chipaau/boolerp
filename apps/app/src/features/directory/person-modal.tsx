import { Link } from '@tanstack/react-router'
import { Network } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@workspace/ui/components/dialog'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { awayInfo, directReports, unitPath } from '@/features/org/logic'
import { usePeople, useUnits } from '@/features/org/queries'
import { PersonAvatar, copyText, usePeopleMap } from './people-bits'

/**
 * One person, in a modal: who they are, where they sit, how to reach them, and their reporting
 * line. Every name in it opens that person instead.
 */
export function PersonModal({ id, onClose, onOpen }: { id: string | undefined; onClose: () => void; onOpen: (id: string) => void }) {
  const units = useUnits()
  const people = usePeople()
  const byId = usePeopleMap()
  const toast = useToast()
  const p = id ? byId[id] : undefined
  const today = new Date()
  const away = p ? awayInfo(p, today) : null
  const mgr = p ? byId[p.managerId ?? ''] : undefined
  const reports = p ? directReports(people, p.id) : []
  const peers = mgr && p ? directReports(people, mgr.id).filter((x) => x.id !== p.id) : []

  function copy(text: string, label: string) {
    copyText(text)
    toast(`${label} copied · ${text}`)
  }

  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton className="max-h-[86vh] gap-0 overflow-y-auto p-0 sm:max-w-[420px]">
        {p && (
          <>
            <div className="flex flex-row items-start gap-3.5 px-6 pt-6 pb-4 pe-14 text-left">
              <PersonAvatar person={p} units={units} className="size-[52px]" fallbackClassName="text-base" />
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-[19px] leading-[1.3] tracking-[-0.015em]">{p.name}</DialogTitle>
                <DialogDescription className="mt-0.5 text-ui-sm text-body">{p.title}</DialogDescription>
                <div className="mt-0.5 text-compact text-faint">{unitPath(units, p.unitId)}</div>
              </div>
            </div>
            {away && <div className={cn('mx-6 mb-4 rounded-[10px] px-3.5 py-[11px] text-compact font-bold', away.now ? 'bg-tone-warning-soft text-tone-warning-foreground' : 'bg-muted text-body')}>{away.long}</div>}
            <div className="px-6 pb-4">
              <Button variant="outline" size="sm" render={<Link to="/$app/$section" params={{ app: 'directory', section: 'org' }} search={{ id: p.id }} />}>
                <Network className="size-3.5" strokeWidth={1.6} />
                See in org chart
              </Button>
            </div>

            <section className="border-t border-divider px-6 py-4">
              <div className="mb-2 text-overline text-faint">Contact</div>
              {[
                { k: 'Email', v: p.email },
                { k: 'Phone', v: p.phone },
                { k: 'Chat', v: p.chat },
              ].map((c) => (
                <button key={c.k} type="button" onClick={() => copy(c.v, c.k)} className="-mx-2.5 flex w-[calc(100%+20px)] items-center gap-3 rounded-[9px] px-2.5 py-2 text-left outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="w-[52px] shrink-0 text-caption text-faint">{c.k}</span>
                  <span className="min-w-0 flex-1 truncate text-ui-sm text-body">{c.v}</span>
                  <span className="text-fine font-bold text-faint">Copy</span>
                </button>
              ))}
            </section>

            <section className="border-t border-divider px-6 py-4 pb-8">
              <div className="mb-3 text-overline text-faint">Reporting line</div>
              {mgr ? (
                <div>
                  <div className="text-caption text-faint">Reports to</div>
                  <button type="button" onClick={() => onOpen(mgr.id)} className="mt-1 block text-sm font-bold text-link outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                    {mgr.name}
                  </button>
                  <div className="text-compact text-muted-foreground">{mgr.title}</div>
                </div>
              ) : (
                <div className="text-compact text-muted-foreground">Top of the tree — reports to no one.</div>
              )}
              {peers.length > 0 && (
                <div className="mt-2.5 text-compact text-muted-foreground">
                  {peers.length} {peers.length === 1 ? 'peer reports' : 'peers report'} to {mgr?.name}
                </div>
              )}
              {reports.length > 0 && (
                <div className="mt-[18px]">
                  <div className="mb-2 text-caption text-faint">
                    {reports.length} direct {reports.length === 1 ? 'report' : 'reports'}
                  </div>
                  {reports.map((r) => {
                    const ra = awayInfo(r, today)
                    return (
                      <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="-mx-2.5 flex w-[calc(100%+20px)] items-center gap-[11px] rounded-[9px] px-2.5 py-2 text-left outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                        <PersonAvatar person={r} units={units} className="size-[30px]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ui-sm font-bold text-foreground">{r.name}</span>
                          <span className="block truncate text-caption text-faint">{r.title}</span>
                        </span>
                        {ra?.now && <span aria-hidden="true" className="size-[7px] rounded-full bg-tone-warning" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

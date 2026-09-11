import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { binCode } from '@/features/org/logic'
import { useSiteActions } from '@/features/org/queries'
import type { Site } from '@/features/org/types'

const PRESETS: [number, number, string][] = [[3, 4, 'Small · 12 bins'], [6, 8, 'Medium · 48 bins'], [10, 12, 'Large · 120 bins'], [0, 0, 'None']]

/** Bins are the shelf positions pickers scan: aisles lettered A, B, C, positions numbered 01 upward. */
export function BinsDialog({ site, onClose }: { site: Site | null; onClose: () => void }) {
  const actions = useSiteActions()
  const toast = useToast()
  const [aisles, setAisles] = useState(0)
  const [per, setPer] = useState(0)
  useEffect(() => {
    if (!site) return
    setAisles(site.aisles || (site.bins ? Math.ceil(site.bins / (site.per || 4)) : 0))
    setPer(site.per || (site.bins ? 4 : 0))
  }, [site])
  const total = aisles * per
  const shownA = Math.min(aisles, 6), shownP = Math.min(per, 10)
  const stepper = (label: string, note: string, v: number, setV: (n: number) => void, max: number) => (
    <div className="flex items-center gap-3.5 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-ui-sm font-bold text-foreground">{label}</span>
        <span className="mt-0.5 block text-caption leading-[1.45] text-faint">{note}</span>
      </span>
      <span className="flex items-center gap-1">
        <Button variant="secondary" size="icon-sm" aria-label={`Fewer ${label.toLowerCase()}`} disabled={v <= 0} onClick={() => setV(Math.max(0, v - 1))}>
          <Minus />
        </Button>
        <span className="min-w-[34px] text-center text-[15px] font-black tabular-nums text-foreground">{v}</span>
        <Button variant="secondary" size="icon-sm" aria-label={`More ${label.toLowerCase()}`} disabled={v >= max} onClick={() => setV(Math.min(max, v + 1))}>
          <Plus />
        </Button>
      </span>
    </div>
  )
  return (
    <Dialog open={site !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[580px]" showCloseButton>
        {site && (
          <>
            <DialogHeader className="px-6 pt-[22px] pb-1 pr-14 text-left">
              <DialogTitle className="text-[19px] tracking-[-0.015em]">{site.bins ? 'Bin layout · ' : 'Set up bins · '}{site.name}</DialogTitle>
              <DialogDescription className="mt-1 text-compact leading-[1.55] text-muted-foreground">
                Bins are the shelf positions pickers scan. Each one is named by its aisle letter and position — aisle A, position 1 is <strong className="text-foreground">A-01</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-2">
              <div className="my-4 flex flex-wrap gap-[7px]">
                {PRESETS.map(([a, p, l]) => (
                  <button key={l} type="button" onClick={() => { setAisles(a); setPer(p) }} className={cn('h-8 rounded-full px-3.5 text-fine font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring', aisles === a && per === p ? 'bg-primary text-foreground' : 'text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-surface-soft')}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="divide-y divide-divider rounded-xl bg-surface-band px-3.5">
                {stepper('Aisles', 'Lettered A, B, C… as you walk the floor', aisles, setAisles, 12)}
                {stepper('Bins in each aisle', 'Numbered 01 upward along the aisle', per, setPer, 24)}
              </div>
              {total ? (
                <div className="mt-4 rounded-xl bg-surface-band p-3.5">
                  <div className="mb-2.5 text-overline text-faint">
                    {total} bins · A-01 to {binCode(Math.max(aisles - 1, 0), per - 1)}
                  </div>
                  <div className="flex flex-col gap-[7px]">
                    {Array.from({ length: shownA }, (_, r) => (
                      <div key={r} className="flex items-center gap-2.5">
                        <span className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-muted text-fine font-black text-muted-foreground">{'ABCDEFGHIJKL'[r]}</span>
                        <span className="flex min-w-0 flex-wrap gap-[5px]">
                          {Array.from({ length: shownP }, (__, i) => (
                            <span key={i} className="inline-flex h-[23px] items-center rounded-[7px] bg-card px-2 font-mono text-[11px] font-bold text-body shadow-[inset_0_0_0_1px_var(--divider)]">{binCode(r, i)}</span>
                          ))}
                          {per > shownP && <span className="inline-flex h-[23px] items-center px-2 text-[11px] font-bold text-faint">+{per - shownP}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                  {aisles > shownA && <div className="mt-2.5 text-caption text-faint">+ {aisles - shownA} more aisles, through {'ABCDEFGHIJKL'[aisles - 1]}</div>}
                </div>
              ) : (
                <div className="mt-3.5 px-0.5 text-compact leading-[1.55] text-faint">Set at least one aisle and one bin to see the layout. You can leave this at zero and come back when the racking is in.</div>
              )}
            </div>
            <div className="flex items-center justify-end gap-[9px] px-6 pt-4 pb-[18px]">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => { actions.setBins(site.id, aisles, per); toast(total ? `${total} bins ready at ${site.name}` : 'Saved without bins'); onClose() }}>{total ? (site.bins ? 'Save layout' : `Create ${total} bins`) : 'Save without bins'}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

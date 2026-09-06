import { X } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { Kbd } from '@workspace/ui/components/kbd'

const GROUPS: { title: string; rows: { keys: string[]; does: string }[] }[] = [
  {
    title: 'Views',
    rows: [
      { keys: ['D'], does: 'Day' },
      { keys: ['W'], does: 'Week' },
      { keys: ['M'], does: 'Month' },
      { keys: ['A'], does: 'Agenda' },
      { keys: ['R'], does: 'Rooms' },
    ],
  },
  {
    title: 'Move around',
    rows: [
      { keys: ['←', '→'], does: 'Previous or next period' },
      { keys: ['T'], does: 'Jump to today' },
      { keys: ['N'], does: 'New meeting' },
      { keys: ['?'], does: 'This list' },
    ],
  },
  {
    title: 'On the board',
    rows: [
      { keys: ['Drag'], does: 'Empty time drafts a meeting; a meeting you organise moves' },
      { keys: ['Drag edge'], does: 'The bottom edge of your meeting changes its length' },
      { keys: ['Esc'], does: 'Abandon a drag' },
    ],
  },
]

/** Every key the calendar board answers to, opened with "?" or the keyboard button. */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[480px]" showCloseButton={false}>
        <DialogHeader className="flex-row items-start justify-between gap-3.5 border-b border-divider px-6 pt-[22px] pb-4 text-left">
          <div>
            <DialogTitle className="text-[19px] tracking-[-0.015em]">Keyboard shortcuts</DialogTitle>
            <DialogDescription className="mt-1 text-compact text-muted-foreground">Keys work anywhere on the board, outside a text field.</DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </DialogHeader>
        <div className="max-h-[min(66vh,520px)] overflow-y-auto px-6 pt-2 pb-5">
          {GROUPS.map((g) => (
            <div key={g.title} className="pt-4">
              <div className="mb-1.5 text-overline text-faint">{g.title}</div>
              {g.rows.map((r) => (
                <div key={r.does} className="flex items-center gap-3 border-t border-divider py-2 first:border-t-0">
                  <span className="flex w-[104px] shrink-0 items-center gap-1">
                    {r.keys.map((k) => (
                      <Kbd key={k} className="bg-muted">
                        {k}
                      </Kbd>
                    ))}
                  </span>
                  <span className="text-compact text-body">{r.does}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

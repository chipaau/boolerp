import { ArrowUpRight, X } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { Kbd } from '@workspace/ui/components/kbd'
import { useSupportLinks } from './queries'

/** Where to get help: the help centre, the support inbox, what's new, and a way into feedback. */
export function SupportDialog({ open, onClose, onFeedback }: { open: boolean; onClose: () => void; onFeedback: () => void }) {
  const links = useSupportLinks()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[440px]" showCloseButton={false}>
        <DialogHeader className="flex-row items-start justify-between gap-3.5 border-b border-divider px-6 pt-[22px] pb-4 text-left">
          <div>
            <DialogTitle className="text-[19px] tracking-[-0.015em]">Support</DialogTitle>
            <DialogDescription className="mt-1 text-compact text-muted-foreground">Stuck, or something looks wrong? Start here.</DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </DialogHeader>
        <div className="px-4 pt-3 pb-2">
          {links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-[10px] px-3 py-[11px] outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
              <span className="min-w-0 flex-1">
                <span className="block text-ui-sm font-bold text-foreground">{l.label}</span>
                <span className="mt-0.5 block text-fine text-faint">{l.hint}</span>
              </span>
              <ArrowUpRight className="size-4 text-faint transition-colors duration-instant group-hover:text-foreground" strokeWidth={1.75} />
            </a>
          ))}
          <div className="mx-3 my-2 border-t border-divider" />
          <div className="flex items-center gap-3 px-3 py-2 text-fine text-faint">
            <span className="min-w-0 flex-1">
              Search anything with <Kbd className="bg-muted">⌘K</Kbd> · the calendar lists its keys on <Kbd className="bg-muted">?</Kbd>
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-divider px-6 pt-[15px] pb-[18px]">
          <span className="text-meta text-muted-foreground">Found a bug or have an idea?</span>
          <Button variant="outline" onClick={onFeedback}>
            Send feedback
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

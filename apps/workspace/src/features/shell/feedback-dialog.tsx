import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { Segmented, SegmentedItem } from '@workspace/ui/components/segmented'
import { useToast } from '@workspace/ui/components/toast'
import { useSendFeedback } from './queries'
import type { FeedbackKind } from './types'

const KINDS: { key: FeedbackKind; label: string; prompt: string }[] = [
  { key: 'idea', label: 'Idea', prompt: 'What would make this better? A sentence is plenty.' },
  { key: 'problem', label: 'Problem', prompt: 'What happened, and what did you expect instead?' },
  { key: 'question', label: 'Question', prompt: 'Ask away. Someone at Bool reads every one.' },
]

/** Feedback to Bool from anywhere in the app: a kind, a few lines, and the page it came from. */
export function FeedbackDialog({ open, page, onClose }: { open: boolean; page: string; onClose: () => void }) {
  const send = useSendFeedback()
  const toast = useToast()
  const [kind, setKind] = useState<FeedbackKind>('idea')
  const [message, setMessage] = useState('')
  const [withPage, setWithPage] = useState(true)
  const meta = KINDS.find((k) => k.key === kind) ?? KINDS[0]

  useEffect(() => {
    if (open) {
      setMessage('')
      setWithPage(true)
    }
  }, [open])

  async function submit() {
    await send.mutateAsync({ kind, message: message.trim(), page: withPage ? page : undefined })
    onClose()
    toast('Sent to Bool — thank you')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[480px]" showCloseButton={false}>
        <DialogHeader className="flex-row items-start justify-between gap-3.5 border-b border-divider px-6 pt-[22px] pb-4 text-left">
          <div>
            <DialogTitle className="text-[19px] tracking-[-0.015em]">Send feedback</DialogTitle>
            <DialogDescription className="mt-1 text-compact text-muted-foreground">Goes straight to the people who build Bool.</DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </DialogHeader>
        <div className="px-6 pt-5 pb-3">
          <Segmented>
            {KINDS.map((k) => (
              <SegmentedItem key={k.key} active={kind === k.key} onClick={() => setKind(k.key)}>
                {k.label}
              </SegmentedItem>
            ))}
          </Segmented>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            autoFocus
            placeholder={meta.prompt}
            className="mt-4 w-full resize-y rounded-[10px] bg-surface-band px-[13px] py-[11px] text-compact leading-[1.6] text-foreground outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring"
          />
          <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 rounded-lg py-1 text-compact text-body">
            <Checkbox checked={withPage} onCheckedChange={(v) => setWithPage(!!v)} />
            <span>
              Include the page I&apos;m on <span className="text-faint">({page})</span>
            </span>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-divider px-6 pt-[15px] pb-[18px]">
          <span className="text-meta text-muted-foreground">We reply by email when there is something to say.</span>
          <div className="flex items-center gap-[9px]">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!message.trim() || send.isPending}>
              Send
              <ButtonArrow />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

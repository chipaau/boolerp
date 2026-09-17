import { useEffect, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { useNumberingActions } from '@/features/org/queries'
import type { NumberingRule } from '@/features/org/types'
import { FieldLabel, fieldClass } from './control-bits'

/** Edit one numbering pattern and its next value; issued codes are never touched. */
export function CodePatternDialog({ rule, onClose }: { rule: NumberingRule | null; onClose: () => void }) {
  const actions = useNumberingActions()
  const toast = useToast()
  const [pattern, setPattern] = useState('')
  const [next, setNext] = useState('')
  useEffect(() => {
    if (!rule) return
    setPattern(rule.pattern); setNext(rule.next)
  }, [rule])

  function save() {
    if (!rule) return
    const p = pattern.trim()
    if (!p) return toast('A pattern is required', { ok: false })
    const undo = actions.update(rule, { pattern: p, next: next.trim() || rule.next })
    toast(`${rule.label} updated`, { undo: () => { undo(); toast(`${rule.label} pattern restored`) } })
    onClose()
  }

  return (
    <Dialog open={rule !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[520px]" showCloseButton>
        <DialogHeader className="px-6 pt-[22px] pb-3 pr-14 text-left">
          <DialogTitle className="text-[19px] tracking-[-0.015em]">Edit {(rule?.label ?? 'pattern').toLowerCase()}</DialogTitle>
          <DialogDescription className="mt-1 text-compact text-muted-foreground">New records only. Anything already numbered keeps its code.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
            <div>
              <FieldLabel>Pattern</FieldLabel>
              <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="GRN-YYYY-####" className={cn(fieldClass, 'font-mono text-[13px]')} autoFocus />
            </div>
            <div>
              <FieldLabel>Next value</FieldLabel>
              <input value={next} onChange={(e) => setNext(e.target.value)} placeholder="GRN-2026-0148" className={cn(fieldClass, 'font-mono text-[13px]')} />
            </div>
          </div>
          <div className="mt-3.5 rounded-xl border border-border bg-surface-band px-[15px] py-[13px] text-compact leading-[1.55] text-body">
            # is a digit · A is a letter · YYYY is the year. Next records look like {next.trim() || 'the value above'}.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 pt-4 pb-[22px]">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save pattern</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

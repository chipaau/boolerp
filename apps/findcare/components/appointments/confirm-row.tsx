'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

/** An inline "are you sure?" that takes the place of a detail panel's actions until answered. */
export function ConfirmRow({
  question,
  confirmLabel,
  keepLabel,
  onConfirm,
  onKeep,
}: {
  question: string
  confirmLabel: string
  keepLabel: string
  onConfirm: () => void
  onKeep: () => void
}) {
  const keep = useRef<HTMLButtonElement>(null)
  // Focus the safe answer, so a stray Enter keeps the visit.
  useEffect(() => keep.current?.focus(), [])
  return (
    <div role="group" aria-label={question} className="flex flex-wrap items-center gap-2.5">
      <span className="min-w-[200px] flex-1 text-[13px] text-ink-900">{question}</span>
      <Button variant="dangerSolid" onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button ref={keep} variant="outline" onClick={onKeep}>
        {keepLabel}
      </Button>
    </div>
  )
}

'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Appointment } from '@/lib/data'
import { editRequest, fmtDay, sessionFor } from '@/lib/data'

/** A request awaiting the clinic: the window asked for, and the note, which the patient can edit. */
export function RequestNote({ appt: a, onMessage }: { appt: Appointment; onMessage: (msg: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const fieldId = useId()
  const se = sessionFor(a.sessionId)
  return (
    <section aria-label="Your request" className="flex flex-col gap-2.5 rounded-2xl bg-wash-1 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2.5">
        <h3 className="text-[13.5px] font-semibold">Your request</h3>
        <span className="text-[12px] font-medium text-ink-600">
          {fmtDay(a.date)} · {se.start}–{se.end}
        </span>
      </div>
      {draft == null ? (
        <>
          <p className="text-[12.5px] leading-normal text-ink-700">{a.reason ? `Note: ${a.reason}` : 'No note added.'}</p>
          <Button variant="soft" size="sm" className="self-start" onClick={() => setDraft(a.reason)}>
            Edit note
          </Button>
        </>
      ) : (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            const r = editRequest(a.id, draft.trim())
            setDraft(null)
            onMessage(r.ok ? 'Request updated. The clinic sees your new note.' : 'The clinic has already answered this request.')
          }}
        >
          <label htmlFor={fieldId} className="sr-only">
            Note for the clinic
          </label>
          <textarea
            id={fieldId}
            rows={3}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What’s the visit for?"
            className="w-full resize-y rounded-xl bg-white px-3 py-2.5 text-[13px] leading-normal text-ink-900 shadow-[inset_0_0_0_1px_rgba(30,10,24,.1)] outline-none placeholder:text-ink-400 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { ART_KINDS } from './types'
import type { ArtKind } from './types'

const KEY = 'findcare.careArt'

const isKind = (v: string | null): v is ArtKind => ART_KINDS.some((a) => a.kind === v)

/** The artwork this browser last chose, Pathways by default. */
export function useArtKind() {
  const [kind, setKind] = useState<ArtKind>(() => {
    if (typeof window === 'undefined') return 'pathways'
    const saved = localStorage.getItem(KEY)
    return isKind(saved) ? saved : 'pathways'
  })
  const choose = (k: ArtKind) => {
    setKind(k)
    try {
      localStorage.setItem(KEY, k)
    } catch {
      // storage blocked: the choice lasts for this page
    }
  }
  return [kind, choose] as const
}

/** Three small dots beside the art; choosing one shows its name briefly, then the name fades. */
export function ArtSwitch({
  value,
  onChange,
  tip = 'below',
  className,
}: {
  value: ArtKind
  onChange: (kind: ArtKind) => void
  /** Which side the name appears on, away from whatever sits next to the dots. */
  tip?: 'above' | 'below'
  className?: string
}) {
  const [shown, setShown] = useState<string | null>(null)
  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(null), 1800)
    return () => clearTimeout(t)
  }, [shown])
  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <div role="radiogroup" aria-label="Artwork" className="inline-flex items-center gap-1">
        {ART_KINDS.map(({ kind, label }) => {
          const on = kind === value
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              title={label}
              onClick={() => {
                onChange(kind)
                setShown(label)
              }}
              className="grid size-5 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span className={cn('rounded-full transition-all', on ? 'size-2 bg-indigo-900' : 'size-1.5 bg-ink-400 hover:bg-ink-700')} />
            </button>
          )
        })}
      </div>
      <span
        aria-live="polite"
        className={cn(
          'pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-indigo-900 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-white transition-opacity duration-300',
          tip === 'above' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          shown ? 'opacity-100' : 'opacity-0',
        )}
      >
        {shown}
      </span>
    </div>
  )
}

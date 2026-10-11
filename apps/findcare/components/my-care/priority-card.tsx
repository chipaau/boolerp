'use client'

import Link from 'next/link'
import { useState } from 'react'
import { declineOffer } from '@/lib/data'
import type { Account } from '@/lib/data'
import { priority } from './dashboard'

const KEY = 'findcare.myCare.dismissed'

const readDismissed = () => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[])
  } catch {
    return new Set<string>()
  }
}

/**
 * The one thing that most needs the patient, on the dark indigo card. "Not now" hides a card on this
 * device; an earlier-slot offer can only be taken or declined ("Keep mine" declines it).
 */
export function PriorityCard({ account }: { account: Account }) {
  const [dismissed, setDismissed] = useState(readDismissed)
  const card = priority(account, dismissed)
  if (!card) return null

  const dismiss = () => {
    if (card.dismiss.offerId) return declineOffer(card.dismiss.offerId)
    const next = new Set(dismissed).add(card.key)
    setDismissed(next)
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]))
    } catch {
      // storage blocked: hidden for this page only
    }
  }

  const cta = 'flex h-8 items-center rounded-full bg-white px-4 text-[10.5px] font-medium tracking-[0.18em] text-ink-900 uppercase no-underline hover:bg-indigo-100'
  return (
    <section aria-label={card.kicker} className="rounded-[20px] bg-indigo-900 px-[18px] py-4 text-white shadow-[0_16px_40px_rgba(42,37,72,.25)]">
      <div className="eyebrow flex items-center justify-between gap-2.5 text-indigo-300">
        <span>{card.kicker}</span>
        <span className="text-white tabular-nums">{card.right}</span>
      </div>
      <p className="mt-2.5 text-[13px] leading-[1.45] font-medium text-pretty">{card.line}</p>
      <div className="mt-3 flex items-center gap-3.5">
        {card.cta.external ? (
          <a href={card.cta.href} target="_blank" rel="noopener noreferrer" className={cta}>
            {card.cta.label}
          </a>
        ) : (
          <Link href={card.cta.href} className={cta}>
            {card.cta.label}
          </Link>
        )}
        <button type="button" onClick={dismiss} className="cursor-pointer border-0 bg-transparent p-0 text-[10.5px] font-medium tracking-[0.18em] text-indigo-300 uppercase hover:text-white">
          {card.dismiss.label}
        </button>
      </div>
    </section>
  )
}

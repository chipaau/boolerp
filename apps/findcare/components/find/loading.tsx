'use client'

import { useEffect, useState } from 'react'

// The prototype's short pause before results: a spinner and a rotating line, so a search feels
// considered rather than instant. Starts on a random line so repeat searches don't read the same.
const MESSAGES = [
  'Warming up the stethoscopes…',
  'Checking who’s in today…',
  'Counting open chairs in the waiting room…',
  'Asking reception nicely…',
  'Taking the island’s pulse…',
  'Sorting by soonest…',
]

export function SearchLoading() {
  const [i, setI] = useState(() => Math.floor(Math.random() * MESSAGES.length))
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 900)
    return () => window.clearInterval(id)
  }, [])
  return (
    <section role="status" className="flex flex-col items-center gap-4 pt-16 pb-[120px]">
      <div aria-hidden className="size-7 animate-spin rounded-full border-2 border-indigo-900/12 border-t-indigo-900" />
      <div className="h-5 text-[14px] text-ink-600">
        <span key={i} className="animate-fc-rise inline-block">
          {MESSAGES[i]}
        </span>
      </div>
    </section>
  )
}

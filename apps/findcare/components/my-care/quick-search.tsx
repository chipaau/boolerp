'use client'

import { ArrowRight, Navigation, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { routes } from '@/lib/routes'

/** The search pill under the art: search Find care, or browse every doctor. */
export function QuickSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        router.push(q.trim() ? routes.find(undefined, { q }) : routes.find('doctors'))
      }}
      className="flex h-12 w-full max-w-[520px] items-center gap-2.5 rounded-full bg-white/55 pr-1.5 pl-[18px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.95),0_12px_30px_rgba(106,92,176,.12)] backdrop-blur-[18px] focus-within:ring-2 focus-within:ring-indigo-500/40"
    >
      <Search aria-hidden className="size-4 shrink-0 text-ink-500" strokeWidth={1.8} />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Doctor, specialty or clinic"
        placeholder="Doctor, specialty or clinic"
        className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-ink-900 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
      />
      <button type="submit" aria-label="Search" className="flex h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-indigo-900 text-white hover:bg-indigo-950 min-[760px]:px-4">
        <span className="cta-label hidden text-[10.5px] min-[760px]:inline">Search</span>
        <ArrowRight aria-hidden className="size-[15px] min-[760px]:hidden" strokeWidth={2} />
      </button>
      <Link
        href={routes.find('doctors')}
        aria-label="Browse all doctors"
        className="flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-indigo-50 text-indigo-900 no-underline hover:bg-[var(--tint-lilac-bg)] min-[760px]:px-3.5"
      >
        <Navigation aria-hidden className="size-[13px]" strokeWidth={2} />
        <span className="cta-label hidden text-[10.5px] min-[760px]:inline">Browse</span>
      </Link>
    </form>
  )
}

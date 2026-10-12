'use client'

import { Pin } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@workspace/ui/lib/utils'
import { Avatar, initialsOf } from '@/components/ui/avatar'
import { FactTile } from '@/components/ui/text'
import { isSaved, toggleSaved } from '@/lib/data'
import type { Doctor, Specialty } from '@/lib/data'

const ages = (d: Doctor) => (d.ageMin != null && d.ageMax != null ? `${d.ageMin}–${d.ageMax}` : d.ageMin != null ? `${d.ageMin}+` : d.ageMax != null ? `Up to ${d.ageMax}` : 'All')

/** Who the doctor (or service) is: name, specialty, three facts, about and qualifications, and the pin. */
export function ProfileCard({ doctor, spec, signedIn, signInHref }: { doctor: Doctor; spec?: Specialty; signedIn: boolean; signInHref: string }) {
  const router = useRouter()
  const service = doctor.kind === 'service'
  const saved = signedIn && isSaved(doctor.id)
  const label = !signedIn ? 'Sign in to pin' : saved ? 'Unpin from your doctors' : 'Pin to your doctors'
  const langs = doctor.langs
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)
  return (
    <section className="glass flex flex-col gap-[18px] rounded-[22px] p-[22px]">
      <div className="flex items-center gap-3.5">
        <Avatar initials={doctor.initials || initialsOf(doctor.name)} tint={spec?.tint ?? 'blue'} size={64} />
        <div className="min-w-0">
          <h1 className="text-[22px] leading-[1.15] font-semibold tracking-[-0.015em]">{doctor.name}</h1>
          <div className="mt-1 text-[13px] text-ink-600">{service ? `${doctor.duration} · ${doctor.provider}` : spec?.name}</div>
        </div>
        <button
          type="button"
          aria-pressed={saved}
          aria-label={label}
          title={label}
          onClick={() => (signedIn ? toggleSaved(doctor.id) : router.push(signInHref))}
          className={cn(
            'ml-auto flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full outline-none hover:text-indigo-900 focus-visible:ring-2 focus-visible:ring-indigo-500',
            saved ? 'text-indigo-900' : 'text-ink-500',
          )}
        >
          <Pin className="size-[18px] rotate-[35deg]" strokeWidth={1.8} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <FactTile label={service ? 'Duration' : 'Experience'} value={service ? doctor.duration : doctor.years ? `${doctor.years} yrs` : '—'} />
        <FactTile label="Languages" value={langs.length ? `${langs.length} · ${langs[0]}` : '—'} />
        <FactTile label="Ages" value={ages(doctor)} />
      </div>
      {doctor.about && <p className="text-[13.5px] leading-[1.6] text-pretty text-ink-700">{doctor.about}</p>}
      {doctor.quals.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {doctor.quals.map((q) => (
            <li key={q} className="flex items-center gap-2.5 text-[12.5px] text-ink-700">
              <span aria-hidden className="size-1 shrink-0 rounded-full bg-ink-500" />
              {q}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

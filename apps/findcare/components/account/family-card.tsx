import { Plus } from 'lucide-react'
import { Avatar, initialsOf } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { age, db } from '@/lib/data'
import type { Account, Tint } from '@/lib/data'
import { cn } from '@workspace/ui/lib/utils'
import { ACCOUNT_CARD, EditButton } from './parts'

// Family avatars cycle through the soft tints so each person is told apart at a glance.
const TINTS: Tint[] = ['mint', 'butter', 'lilac', 'peach']

/** The people the holder books for, each with relationship and age. */
export function FamilyCard({ account, onAdd, onEdit }: { account: Account; onAdd: () => void; onEdit: (id: string) => void }) {
  const people = account.familyIds.map((id) => db().patients[id])
  return (
    <section className={cn(ACCOUNT_CARD, 'px-3 pt-[18px] pb-3')}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-2.5 pb-2.5">
        <div>
          <h2 className="eyebrow text-ink-500">Family</h2>
          <p className="mt-1 text-[12.5px] text-ink-600">Book and track visits for the people you care for.</p>
        </div>
        <Button onClick={onAdd} className="h-9 gap-2 px-4 tracking-[0.16em]">
          <Plus aria-hidden className="size-3" strokeWidth={2.2} />
          Add
        </Button>
      </div>
      {people.map((p, i) => {
        const years = age(p.dob)
        return (
          <div key={p.id} className="flex items-center gap-3 rounded-[14px] p-2.5 transition-colors hover-glass">
            <Avatar initials={initialsOf(p.name)} tint={TINTS[i % TINTS.length]} size={40} className="text-[13px]!" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium">{p.name}</div>
              <div className="mt-0.5 text-[12px] text-ink-500">
                {p.relation ?? 'Family'}
                {years != null && ` · ${years} ${years === 1 ? 'year' : 'years'}`}
              </div>
            </div>
            <EditButton onClick={() => onEdit(p.id)} aria-label={`Edit ${p.name}`} className="h-8" />
          </div>
        )
      })}
      {people.length === 0 && <p className="px-2.5 py-[18px] text-[13px] text-ink-500">No family members yet.</p>}
    </section>
  )
}

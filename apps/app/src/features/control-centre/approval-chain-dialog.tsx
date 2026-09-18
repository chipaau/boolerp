import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { DatePicker } from '@workspace/ui/components/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { SelectField } from '@workspace/ui/components/select'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { PersonAvatar } from '@/features/directory/people-bits'
import { personById, unitPath } from '@/features/org/logic'
import { useApprovalChainActions, usePeople, useUnits } from '@/features/org/queries'
import type { ApprovalChain, Person, Unit } from '@/features/org/types'
import { FieldLabel, fieldClass } from './control-bits'

/** Approver roles that resolve live to whoever holds them. */
export const APPROVER_ROLES: { name: string; sub: string }[] = [
  { name: 'Site manager', sub: 'Whoever manages the site on the request' },
  { name: 'Unit lead', sub: "The lead of the requester's admin unit" },
  { name: 'Director of Operations', sub: 'Whoever holds that job title' },
]

/** A step is a role name or a person id; this is how either reads. */
export function stepInfo(step: string, people: Person[], units: Unit[]) {
  const p = personById(people, step)
  return p ? { person: p, label: p.name, sub: `${p.title} · ${unitPath(units, p.unitId)}` } : { person: undefined, label: step, sub: 'Role — resolves to whoever holds it' }
}

const RoleMark = () => (
  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-tone-tan-soft text-xs text-tone-tan-foreground">
    ◇
  </span>
)

/** New or edited approval chain: name, threshold, ordered approvers and an optional stand-in. */
export function ApprovalChainDialog({ draft, onClose }: { draft: { edit?: ApprovalChain } | null; onClose: () => void }) {
  const people = usePeople(), units = useUnits()
  const actions = useApprovalChainActions()
  const toast = useToast()
  const [name, setName] = useState('')
  const [threshold, setThreshold] = useState('Any')
  const [steps, setSteps] = useState<string[]>(['Site manager'])
  const [standIn, setStandIn] = useState('')
  const [until, setUntil] = useState('')
  const [pick, setPick] = useState<number | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    if (!draft) return
    const c = draft.edit
    setName(c?.name ?? ''); setThreshold(c?.threshold ?? 'Any'); setSteps(c ? [...c.steps] : ['Site manager']); setStandIn(c?.standIn ?? ''); setUntil(c?.standInUntil ?? ''); setPick(null); setQ('')
  }, [draft])
  const editing = draft?.edit

  const pool = useMemo(
    () => [
      ...APPROVER_ROLES.map((r) => ({ value: r.name, name: r.name, sub: r.sub, person: undefined as Person | undefined })),
      ...people.filter((p) => !p.external && p.status !== 'Exited' && p.role !== 'Staff').map((p) => ({ value: p.id, name: p.name, sub: `${p.title} · ${unitPath(units, p.unitId)}`, person: p })),
    ],
    [people, units]
  )
  const sq = q.trim().toLowerCase()
  const options = pool.filter((o) => !sq || `${o.name} ${o.sub}`.toLowerCase().includes(sq))
  const standIns = people.filter((p) => !p.external && p.status === 'Active' && p.role !== 'Staff')

  const setStep = (i: number, v: string) => setSteps((s) => s.map((x, j) => (j === i ? v : x)))
  const dropStep = (i: number) => { setSteps((s) => { const n = s.filter((_, j) => j !== i); return n.length ? n : ['Site manager'] }); setPick(null) }

  function save() {
    const n = name.trim()
    if (!n) return toast('Name the chain so apps can point at it', { ok: false })
    const fields = { name: n, threshold: threshold.trim() || 'Any', steps: [...steps], standIn: standIn || undefined, standInUntil: standIn ? until || undefined : undefined }
    if (editing) {
      actions.update(editing.id, fields)
      const who = personById(people, standIn)
      toast(`${n} updated${who ? ` · ${who.name} standing in` : ''}`)
    } else {
      actions.create(fields)
      toast(`${n} created — point an app at it to use it`)
    }
    onClose()
  }

  return (
    <Dialog open={draft !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[580px]" showCloseButton>
        <DialogHeader className="px-6 pt-[22px] pb-3 pr-14 text-left">
          <DialogTitle className="text-[19px] tracking-[-0.015em]">{editing ? `Edit ${editing.name}` : 'New approval chain'}</DialogTitle>
          <DialogDescription className="mt-1 text-compact text-muted-foreground">Apps point at a chain by name, so renaming one keeps every link intact.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-6 pb-2">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
            <div>
              <FieldLabel>Chain name</FieldLabel>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Operations sign-off" className={fieldClass} autoFocus />
            </div>
            <div>
              <FieldLabel>Kicks in above</FieldLabel>
              <input value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="MVR 30,000 or Any" className={fieldClass} />
            </div>
          </div>

          <div className="mt-[18px]">
            <FieldLabel>Approvers, in order</FieldLabel>
            <div className="flex flex-col gap-2">
              {steps.map((s, i) => {
                const info = stepInfo(s, people, units)
                const open = pick === i
                return (
                  <div key={i}>
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-caption font-bold text-faint">{i + 1}</span>
                      <button type="button" aria-expanded={open} onClick={() => { setPick(open ? null : i); setQ('') }} className={cn('flex h-12 min-w-0 flex-1 items-center justify-between gap-2.5 rounded-xl bg-surface-band px-[13px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring', open && 'shadow-[inset_0_0_0_1.5px_var(--sage)]')}>
                        <span className="flex min-w-0 items-center gap-[9px]">
                          {info.person ? <PersonAvatar person={info.person} units={units} className="size-7" /> : <RoleMark />}
                          <span className="min-w-0">
                            <span className="block truncate text-ui-sm font-bold text-foreground">{info.label}</span>
                            <span className="mt-px block truncate text-caption text-faint">{info.sub}</span>
                          </span>
                        </span>
                        <ChevronDown className="size-3 shrink-0 text-faint" strokeWidth={1.8} />
                      </button>
                      <button type="button" title="Remove this step" aria-label="Remove this step" onClick={() => dropStep(i)} className="grid size-[34px] shrink-0 place-items-center rounded-full text-[15px] text-faint shadow-[inset_0_0_0_1px_var(--divider)] outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                        −
                      </button>
                    </div>
                    {open && (
                      <div className="mt-2 mb-1 ml-7 rounded-xl border border-divider bg-card px-3 py-[11px]">
                        <div className="mb-2 flex h-[34px] items-center gap-2 rounded-full bg-surface-band px-3">
                          <Search className="size-[13px] text-faint" strokeWidth={1.8} />
                          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search a name, job title or role" className="min-w-0 flex-1 bg-transparent text-compact text-foreground outline-none placeholder:text-placeholder" />
                        </div>
                        <div className="max-h-[210px] overflow-y-auto">
                          {options.map((o) => (
                            <button key={o.value} type="button" onClick={() => { setStep(i, o.value); setPick(null); setQ('') }} className={cn('flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] text-left outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring', s === o.value && 'bg-surface-soft')}>
                              {o.person ? <PersonAvatar person={o.person} units={units} className="size-7" /> : <RoleMark />}
                              <span className="min-w-0 flex-1">
                                <span className="block text-compact font-bold text-foreground">{o.name}</span>
                                <span className="mt-px block text-caption text-faint">{o.sub}</span>
                              </span>
                              {o.person ? (
                                <Badge variant={o.person.role === 'Admin' ? 'success' : 'neutral'} size="sm">
                                  {o.person.role}
                                </Badge>
                              ) : (
                                <Badge variant="warning" size="sm">
                                  Role
                                </Badge>
                              )}
                            </button>
                          ))}
                          {!options.length && <div className="px-2.5 py-3.5 text-compact leading-[1.5] text-body">No one matches that. Try a job title, or pick a role that resolves live.</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <Button variant="outline" size="sm" className="mt-2.5" onClick={() => setSteps((s) => [...s, 'Site manager'])}>
              Add approver
            </Button>
          </div>

          <div className="mt-[22px] border-t border-divider pt-[19px]">
            <div className="mb-1.5 text-overline text-faint">Cover</div>
            <p className="mb-[13px] text-compact leading-[1.55] text-pretty text-body">While an approver is away, requests would otherwise sit. A stand-in signs in their place for as long as you set — every signature is still logged under the stand-in's own name.</p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
              <div>
                <FieldLabel>Stand-in approver</FieldLabel>
                <SelectField
                  aria-label="Stand-in"
                  value={standIn}
                  onValueChange={setStandIn}
                  options={[{ value: '', label: 'No cover — requests wait' }, ...standIns.map((p) => ({ value: p.id, label: `${p.name} · ${p.title}` }))]}
                />
              </div>
              <div>
                <FieldLabel>Until</FieldLabel>
                <DatePicker value={until} disabled={!standIn} onChange={setUntil} aria-label="Until" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-[9px] px-6 pt-3 pb-[18px]">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{editing ? 'Save chain' : 'Create chain'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { SelectField } from '@workspace/ui/components/select'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { CADENCES, isOnBooks, modeHint, siteTypeById } from '@workspace/org/logic'
import { useCountries, usePeople, useRegions, useSiteActions, useSiteTypes, useSites } from '@workspace/org/queries'
import type { Cadence, Site } from '@workspace/org/types'
import { FieldLabel, ModeBadge, fieldClass } from '../shared'

export type SiteDraft = { edit?: Site; typeId?: string }

/**
 * New or edited site: its type (with the rules that brings), name and code, manager and parent,
 * where it is (country › region › city, then the street), and whether it overrides the type's
 * counting policy. Changing the type of a site that holds stock asks first.
 */
export function SiteDialog({ draft, onClose, onSaved }: { draft: SiteDraft | null; onClose: () => void; onSaved: (id: string) => void }) {
  const sites = useSites(), types = useSiteTypes(), people = usePeople(), countries = useCountries(), regions = useRegions()
  const actions = useSiteActions()
  const toast = useToast()
  const [f, setF] = useState({ name: '', code: '', typeId: '', owner: '', parent: '', country: 'Maldives', region: '', place: '', addr: '', cadence: '' as '' | Cadence })
  const [override, setOverride] = useState(false)
  const [swap, setSwap] = useState(false)
  const editing = draft?.edit
  const on = useMemo(() => countries.filter((c) => c.on), [countries])
  useEffect(() => {
    if (!draft) return
    const s = draft.edit
    setF(s ? { name: s.name, code: s.code, typeId: s.typeId, owner: s.ownerId ?? '', parent: s.parent ?? '', country: s.country, region: s.region, place: s.place, addr: s.addr, cadence: s.cadence ?? '' } : { name: '', code: '', typeId: draft.typeId ?? types.at(0)?.id ?? '', owner: '', parent: '', country: on.at(0)?.name ?? 'Maldives', region: '', place: '', addr: '', cadence: '' })
    setOverride(!!s?.cadence)
    setSwap(false)
  }, [draft, types, on])
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }))
  const type = siteTypeById(types, f.typeId)
  const formRegions = regions.filter((r) => r.country === f.country)
  const places = formRegions.find((r) => r.name === f.region)?.places ?? []
  const parentSite = sites.find((s) => s.id === f.parent)
  const countryRec = countries.find((c) => c.name === f.country)
  const prevType = editing ? siteTypeById(types, editing.typeId) : undefined
  const swapNeeded = !!editing && prevType && editing.typeId !== f.typeId && (editing.lines > 0 || editing.bins > 0)

  function save(confirmed = false) {
    const n = f.name.trim()
    if (!n) return toast('Give the site a name', { ok: false })
    if (!f.region) return toast(`Pick a region in ${f.country}`, { ok: false })
    if (!f.place) return toast('Pick the city or island', { ok: false })
    if (swapNeeded && !confirmed) return setSwap(true)
    const code = f.code.trim() || `${n.slice(0, 3).toUpperCase()}-${String(sites.length + 1).padStart(2, '0')}`
    const base = { name: n, code, typeId: f.typeId, country: f.country, region: f.region, place: f.place, addr: f.addr.trim() || '—', ownerId: f.owner || null, parent: f.parent || null, cadence: f.cadence || null }
    if (editing) {
      actions.update(editing.id, { ...base, bins: type.bins ? editing.bins : 0 }, `${n} details edited`)
      toast(`${n} updated`)
      onSaved(editing.id)
    } else {
      const id = actions.create({ ...base, status: 'Active', opened: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), bins: 0, aisles: 0, per: 0, lines: 0, value: '—', counted: '—', util: 0 })
      toast(type.bins ? `${n} created — set up its bins next` : `${n} created — no stock yet`)
      onSaved(id)
    }
    onClose()
  }

  const swapDiffs = prevType && editing ? [
    ['Storage', prevType.mode, type.mode], ['Issuing', prevType.issue ? 'Allowed' : 'Blocked', type.issue ? 'Allowed' : 'Blocked'], ['Bins', prevType.bins ? 'Tracked' : 'Not used', type.bins ? 'Tracked' : 'Not used'], ['Counting', prevType.cadence, type.cadence], ['Negative stock', prevType.negative ? 'Allowed' : 'Blocked', type.negative ? 'Allowed' : 'Blocked'],
  ].filter((d) => d[1] !== d[2]) : []

  return (
    <>
      <Dialog open={draft !== null && !swap} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="gap-0 p-0 sm:max-w-[580px]" showCloseButton>
          <DialogHeader className="px-6 pt-[22px] pb-3 pr-14 text-left">
            <DialogTitle className="text-[19px] tracking-[-0.015em]">{editing ? 'Edit site' : 'New site'}</DialogTitle>
            <DialogDescription className="mt-1 text-compact text-muted-foreground">A site inherits its stock rules from the type you pick.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto px-6 pb-2">
            <div className="overflow-clip rounded-[14px] border border-border">
              <div className="px-3.5 pt-3 pb-3">
                <FieldLabel>Site type</FieldLabel>
                <SelectField aria-label="Site type" value={f.typeId} onValueChange={(v) => set({ typeId: v })} options={types.map((t) => ({ value: t.id, label: t.name }))} />
              </div>
              <div className="border-t border-divider bg-surface-band px-3.5 py-3">
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="text-overline text-faint">This type means</span>
                  <ModeBadge mode={type.mode} />
                </div>
                {[
                  { on: type.mode !== 'None', text: modeHint(type.mode) },
                  { on: type.issue, text: type.issue ? 'Goods can be issued from here.' : 'Issuing from here is blocked.' },
                  { on: type.bins, text: type.bins ? 'Items are tracked down to a bin — you can lay the bins out after the site exists.' : 'Items are tracked at site level, no bins.' },
                ].map((r) => (
                  <div key={r.text} className="flex items-start gap-2.5 py-[3px]">
                    <span aria-hidden="true" className={cn('mt-0.5 grid size-[17px] shrink-0 place-items-center rounded-full text-[10.5px] font-bold', r.on ? 'bg-tone-success-soft text-tone-success-foreground' : 'bg-muted text-faint')}>{r.on ? '✓' : '—'}</span>
                    <span className="min-w-0 flex-1 text-compact leading-[1.5] text-body">{r.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Site name</FieldLabel>
                <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Harbour depot" className={fieldClass} autoFocus />
              </div>
              <div>
                <FieldLabel>Code</FieldLabel>
                <input value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder={`${(f.name || 'SITE').slice(0, 3).toUpperCase()}-${String(sites.length + 1).padStart(2, '0')}`} className={`${fieldClass} font-mono text-compact`} />
              </div>
              <div>
                <FieldLabel>Site manager</FieldLabel>
                <SelectField
                  aria-label="Owner"
                  value={f.owner}
                  onValueChange={(v) => set({ owner: v })}
                  options={[{ value: '', label: 'Unassigned' }, ...people.filter((p) => isOnBooks(p) && p.role !== 'Staff').map((p) => ({ value: p.id, label: `${p.name} · ${p.title}` }))]}
                />
              </div>
              <div>
                <FieldLabel>Parent site</FieldLabel>
                <SelectField
                  aria-label="Sits under"
                  value={f.parent}
                  onValueChange={(v) => set({ parent: v })}
                  options={[{ value: '', label: 'Top level — stands alone' }, ...sites.filter((s) => s.id !== editing?.id && s.country === f.country && s.parent !== editing?.id).map((s) => ({ value: s.id, label: `${s.name} · ${s.code}` }))]}
                />
              </div>
              <div className="text-caption leading-[1.5] text-pretty text-faint sm:col-span-2">{parentSite ? `Rolls up into ${parentSite.name} — stock reports can be read for the parent alone or with everything under it.` : `Leave standalone unless this place is a yard, counter or bay belonging to a bigger site. Only sites in ${f.country} can be a parent.`}</div>
            </div>

            <div className="mt-5 border-t border-divider pt-[18px]">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div className="text-overline text-faint">Where it is</div>
                <span className="text-caption text-faint">{[f.country, f.region, f.place].filter(Boolean).join(' › ')}</span>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <FieldLabel>Country</FieldLabel>
                  <SelectField
                    aria-label="Country"
                    value={f.country}
                    onValueChange={(v) => set({ country: v, region: '', place: '', parent: '' })}
                    options={on.map((c) => c.name)}
                  />
                </div>
                <div>
                  <FieldLabel>Region</FieldLabel>
                  <SelectField
                    aria-label="Region"
                    value={f.region}
                    onValueChange={(v) => set({ region: v, place: '' })}
                    disabled={!formRegions.length}
                    options={[
                      { value: '', label: formRegions.length ? 'Pick a region' : `No regions in ${f.country} yet` },
                      ...formRegions.map((r) => ({ value: r.name, label: `${r.name}${r.origin === 'custom' ? ' · yours' : ''}` })),
                    ]}
                  />
                </div>
                <div>
                  <FieldLabel>City / island</FieldLabel>
                  <SelectField
                    aria-label="City or island"
                    value={f.place}
                    onValueChange={(v) => set({ place: v })}
                    disabled={!places.length}
                    options={[{ value: '', label: places.length ? 'Pick a city or island' : 'Pick a region first' }, ...places.map((p) => ({ value: p, label: p }))]}
                  />
                </div>
                <div>
                  <FieldLabel>Address</FieldLabel>
                  <input value={f.addr} onChange={(e) => set({ addr: e.target.value })} placeholder="Street and number" disabled={!f.place} className={cn(fieldClass, !f.place && 'opacity-50')} />
                </div>
              </div>
              {countryRec && !formRegions.length && <div className="mt-2.5 text-caption leading-[1.5] text-pretty text-faint">Bool hasn't surveyed {f.country}, so its regions are yours to define — add one under System › Regions and it will appear here.</div>}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-band px-4 py-3">
              <span className="min-w-[200px] flex-1 text-compact leading-[1.5] text-pretty text-body">{f.cadence ? `Overridden — this site is counted ${f.cadence === 'None' ? 'never' : f.cadence.toLowerCase()}.` : `Counted ${type.cadence === 'None' ? 'never' : type.cadence.toLowerCase()}, inherited from ${type.name}.`}</span>
              <Button variant="link" size="xs" onClick={() => { if (override) set({ cadence: '' }); setOverride((o) => !o) }}>
                {override ? "Use the type's policy" : 'Override'}
              </Button>
            </div>
            {override && (
              <div className="mt-3">
                <SelectField
                  aria-label="Count cadence"
                  value={f.cadence}
                  onValueChange={(v) => set({ cadence: v as '' | Cadence })}
                  options={[
                    { value: '', label: `Follow the site type (${type.cadence})` },
                    ...[...CADENCES.filter((c) => c !== 'None'), 'None' as const].map((c) => ({
                      value: c,
                      label: `Override — ${c === 'None' ? 'never counted' : c.toLowerCase()}`,
                    })),
                  ]}
                />
                <div className="mt-1.5 text-caption leading-[1.5] text-pretty text-faint">{f.cadence ? `This site is counted ${f.cadence === 'None' ? 'never' : f.cadence.toLowerCase()} regardless of what ${type.name} says. Changing the type later won't move it back.` : `Counted ${type.cadence === 'None' ? 'never' : type.cadence.toLowerCase()}, and follows ${type.name} if that changes.`}</div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-[9px] px-6 pt-3 pb-[18px]">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => save()}>{editing ? 'Save changes' : 'Create site'}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={swap}
        title={editing ? `Move ${editing.name} to ${type.name}?` : 'Change the site type?'}
        description="This site already holds stock, and its rules come from its type. Changing it rewrites how Inventory and Scan treat everything in it — existing records keep their history."
        action={`Change to ${type.name}`}
        danger
        onClose={() => setSwap(false)}
        onConfirm={() => { setSwap(false); save(true) }}
      >
        <div className="overflow-clip rounded-[13px] border border-border bg-surface-band">
          {swapDiffs.map(([label, from, to]) => (
            <div key={label} className="flex flex-wrap items-center gap-2.5 border-b border-divider px-3.5 py-3 last:border-b-0">
              <span className="w-[118px] shrink-0 text-overline text-faint">{label}</span>
              <span className="text-compact text-faint line-through">{from}</span>
              <span className="text-caption text-faint">→</span>
              <span className="text-compact font-bold text-foreground">{to}</span>
            </div>
          ))}
        </div>
        {editing && <div className="mt-3 text-compact leading-[1.55] text-pretty text-faint">{editing.lines} stock {editing.lines === 1 ? 'line' : 'lines'}{editing.bins ? ` across ${editing.bins} bins` : ''} sit here today.{editing.bins && !type.bins ? ' The bin layout stops being used — Inventory falls back to site-level tracking.' : ''}{editing.cadence ? " This site's own counting override stays in force." : ''}</div>}
      </ConfirmDialog>
    </>
  )
}

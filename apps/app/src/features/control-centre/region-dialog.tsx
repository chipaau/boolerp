import { useEffect, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { SelectField } from '@workspace/ui/components/select'
import { useToast } from '@workspace/ui/components/toast'
import { useCountries, useRegionActions } from '@/features/org/queries'
import type { Region } from '@/features/org/types'
import { FieldLabel, fieldClass } from './control-bits'

export type RegionDraft = { edit?: Region; country?: string }

const split = (raw: string) => raw.split(',').map((x) => x.trim()).filter(Boolean)

/**
 * Add or edit a custom region: the middle level of an address, for a country Bool hasn't surveyed.
 * Places are a chip list — Enter or a comma adds, clicking a chip drops it.
 */
export function RegionDialog({ draft, onClose, onSaved }: { draft: RegionDraft | null; onClose: () => void; onSaved?: (country: string) => void }) {
  const countries = useCountries()
  const actions = useRegionActions()
  const toast = useToast()
  const choices = countries.filter((c) => c.on && !c.seeded)
  const [country, setCountry] = useState('')
  const [name, setName] = useState('')
  const [place, setPlace] = useState('')
  const [places, setPlaces] = useState<string[]>([])
  useEffect(() => {
    if (!draft) return
    setCountry(draft.edit?.country ?? draft.country ?? '')
    setName(draft.edit?.name ?? '')
    setPlace('')
    setPlaces(draft.edit?.places.slice() ?? [])
  }, [draft])
  const editing = draft?.edit

  function addPlace(raw = place) {
    const names = split(raw)
    setPlaces((cur) => names.reduce((acc, n) => (acc.includes(n) ? acc : [...acc, n]), cur))
    setPlace('')
  }
  function save() {
    const n = name.trim()
    if (!n) return toast('A region needs a name', { ok: false })
    const target = countries.find((c) => c.name === country)
    if (!target) return toast('Pick a country this region belongs to', { ok: false })
    if (target.seeded && !editing) return toast(`${target.name}'s regions come from Bool — they can't be added to`, { ok: false })
    // a half-typed place still counts
    const all = [...places, ...split(place).filter((x) => !places.includes(x))]
    if (!all.length) return toast('Add at least one city or island — sites are addressed to them', { ok: false })
    if (editing) {
      actions.update(editing.id, { name: n, places: all })
      toast(`${n} updated`)
    } else {
      actions.create({ country, name: n, places: all })
      toast(`${n} added · ${all.length} ${all.length === 1 ? 'place' : 'places'}`)
    }
    onSaved?.(country)
    onClose()
  }

  return (
    <Dialog open={draft !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[520px]" showCloseButton={false}>
        <DialogHeader className="px-6 pt-[22px] pb-3 text-left">
          <DialogTitle className="text-[19px] tracking-[-0.015em]">{editing ? `Edit ${editing.name}` : 'Add a region'}</DialogTitle>
          <DialogDescription className="mt-1 text-compact text-muted-foreground">
            {editing ? 'Renaming carries every site in it along. Removing a city it still holds sites in is refused.' : "The middle level of an address, for a country Bool hasn't surveyed — a province, an emirate, an operating zone."}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <FieldLabel>Country</FieldLabel>
              <SelectField
                aria-label="Country"
                value={country}
                onValueChange={setCountry}
                disabled={!!editing}
                options={[
                  ...(editing && !choices.some((c) => c.name === country) ? [country] : []),
                  ...choices.map((c) => c.name),
                ]}
              />
            </div>
            <div>
              <FieldLabel>Region name</FieldLabel>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Colombo operations" className={fieldClass} autoFocus />
            </div>
          </div>
          <div className="mt-4">
            <FieldLabel>Cities and islands in it</FieldLabel>
            <div className="flex h-10 items-center gap-2.5 rounded-[10px] bg-surface-band pr-1.5 pl-[13px] focus-within:ring-2 focus-within:ring-ring">
              <input
                value={place}
                onChange={(e) => (e.target.value.includes(',') ? addPlace(e.target.value) : setPlace(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  addPlace()
                }}
                placeholder="Type a name and press enter"
                aria-label="Add a city or island"
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-placeholder"
              />
              <Button variant="outline" size="xs" onClick={() => addPlace()}>
                Add
              </Button>
            </div>
            {places.length > 0 && (
              <div className="mt-[11px] flex flex-wrap gap-1.5">
                {places.map((p) => (
                  <button key={p} type="button" onClick={() => setPlaces((cur) => cur.filter((x) => x !== p))} aria-label={`Remove ${p}`} className="inline-flex h-[30px] items-center gap-2 rounded-full bg-muted px-3 text-compact font-semibold text-body outline-none hover:bg-secondary-hover focus-visible:ring-2 focus-visible:ring-ring">
                    {p}
                    <span aria-hidden="true" className="text-faint">
                      ✕
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-[11px] text-caption leading-[1.5] text-pretty text-faint">
              {places.length ? `Sites in ${name.trim() || 'this region'} will be addressed to one of these, then a street line.` : 'These are the third level of an address — the city or island a site actually sits on.'}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-[9px] px-6 pt-4 pb-[18px]">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{editing ? 'Save region' : 'Add region'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

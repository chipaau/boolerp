import { useEffect, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { useToast } from '@workspace/ui/components/toast'
import { UNIT_KINDS, liveUnits, unitById, unitChain, unitDescendants, unitPath, unitTone } from '@/features/org/logic'
import { useUnitActions, useUnits } from '@/features/org/queries'
import type { Tone, Unit } from '@/features/org/types'
import { FieldLabel, fieldClass } from './control-bits'

const SWATCHES: { name: string; tone: Tone }[] = [
  { name: 'Sage', tone: 'success' },
  { name: 'Plum', tone: 'plum' },
  { name: 'Slate', tone: 'slate' },
  { name: 'Tan', tone: 'tan' },
  { name: 'Amber', tone: 'warning' },
  { name: 'Clay', tone: 'risk' },
  { name: 'Rose', tone: 'rose' },
]

export type UnitDraft = { edit?: Unit; parent: string | null }

/** New or edited admin unit: name, where it sits, the short code and type the record keeps, and its colour. */
export function UnitDialog({ draft, onClose, onSaved }: { draft: UnitDraft | null; onClose: () => void; onSaved: (id: string) => void }) {
  const units = useUnits()
  const actions = useUnitActions()
  const toast = useToast()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<Unit['kind']>('Team')
  const [parent, setParent] = useState('')
  const [tone, setTone] = useState<Tone | undefined>(undefined)
  useEffect(() => {
    if (!draft) return
    setName(draft.edit?.name ?? '')
    setCode(draft.edit?.code ?? '')
    setKind(draft.edit?.kind ?? 'Team')
    setParent(draft.edit?.parent ?? draft.parent ?? '')
    setTone(draft.edit?.tone)
  }, [draft])
  const editing = draft?.edit

  function save() {
    const n = name.trim()
    if (!n) return toast('A unit needs a name', { ok: false })
    if (editing) {
      if (parent === editing.id) return toast('A unit cannot sit inside itself', { ok: false })
      if (unitDescendants(units, editing.id).some((u) => u.id === parent)) return toast('That would put the unit inside its own child', { ok: false })
      actions.update(editing.id, { name: n, code: code.trim() || editing.code, kind, parent: parent || null, tone })
      toast(`${n} updated`)
      onSaved(editing.id)
    } else {
      const id = actions.create({ name: n, code: code.trim() || n.slice(0, 3).toUpperCase(), kind, parent: parent || null, tone })
      toast(`${n} created`)
      onSaved(id)
    }
    onClose()
  }

  return (
    <Dialog open={draft !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[520px]" showCloseButton={false}>
        <DialogHeader className="px-6 pt-[22px] pb-3 text-left">
          <DialogTitle className="text-[19px] tracking-[-0.015em]">{editing ? `Edit ${editing.name}` : 'New admin unit'}</DialogTitle>
          <DialogDescription className="mt-1 text-compact text-muted-foreground">{editing ? 'Renaming is safe — employees, approvals and the Directory follow the unit, not its name.' : 'Units are the org tree every other app routes through.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 pb-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel>Unit name</FieldLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warehouse" className={fieldClass} autoFocus />
          </div>
          <div>
            <FieldLabel>Short code</FieldLabel>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="OPS-WH" className={`${fieldClass} font-mono text-compact`} />
          </div>
          <div>
            <FieldLabel>Type</FieldLabel>
            <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as Unit['kind'])}>
              {UNIT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Sits under</FieldLabel>
            <NativeSelect value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Top level — no parent</option>
              {liveUnits(units).filter((u) => u.id !== editing?.id).map((u) => (
                <option key={u.id} value={u.id}>
                  {unitPath(units, u.id, ' › ')}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Colour</FieldLabel>
            <UnitColour units={units} parent={parent || null} tone={tone} onPick={setTone} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-[9px] px-6 pt-4 pb-[18px]">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{editing ? 'Save changes' : 'Create unit'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Compact tone dots; with none picked, a lighter ring marks the colour the unit inherits from the unit it sits under. */
function UnitColour({ units, parent, tone, onPick }: { units: Unit[]; parent: string | null; tone?: Tone; onPick: (tone: Tone | undefined) => void }) {
  const inherited = parent ? unitTone(units, parent) : undefined
  const from = parent ? unitChain(units, parent).reverse().find((u) => u.tone) ?? unitById(units, parent) : undefined
  const state = tone ? null : from ? `Using ${from.name}'s colour` : 'Using the default colour'
  return (
    <>
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1.5">
        <div role="radiogroup" aria-label="Unit colour" className="flex items-center gap-2">
          {SWATCHES.map((sw) => {
            const on = tone === sw.tone
            const ghost = !tone && inherited === sw.tone
            return (
              <button
                key={sw.tone}
                type="button"
                role="radio"
                aria-checked={on}
                title={sw.name}
                aria-label={sw.name}
                onClick={() => onPick(sw.tone)}
                className="size-[18px] rounded-full outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card"
                style={{
                  backgroundColor: `var(--tone-${sw.tone})`,
                  boxShadow: on ? `0 0 0 2px var(--card), 0 0 0 4px var(--tone-${sw.tone})` : ghost ? `0 0 0 2px var(--card), 0 0 0 3px color-mix(in oklab, var(--tone-${sw.tone}) 45%, transparent)` : undefined,
                }}
              />
            )
          })}
        </div>
        {state && <span className="text-caption text-faint">{state}</span>}
        {tone && (
          <button type="button" onClick={() => onPick(undefined)} className="text-caption text-faint underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:underline">
            Reset
          </button>
        )}
      </div>
      <p className="mt-1 text-caption text-faint">Tints this unit in the org chart and Directory. Sub-units use it unless they pick their own.</p>
    </>
  )
}

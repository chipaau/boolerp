import { useEffect, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { useToast } from '@workspace/ui/components/toast'
import { UNIT_KINDS, liveUnits, unitDescendants, unitPath } from '@/features/org/logic'
import { useUnitActions, useUnits } from '@/features/org/queries'
import type { Unit } from '@/features/org/types'
import { FieldLabel, fieldClass } from './control-bits'

export type UnitDraft = { edit?: Unit; parent: string | null }

/** New or edited admin unit: name, short code, kind and where it sits. */
export function UnitDialog({ draft, onClose, onSaved }: { draft: UnitDraft | null; onClose: () => void; onSaved: (id: string) => void }) {
  const units = useUnits()
  const actions = useUnitActions()
  const toast = useToast()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<Unit['kind']>('Team')
  const [parent, setParent] = useState('')
  useEffect(() => {
    if (!draft) return
    setName(draft.edit?.name ?? '')
    setCode(draft.edit?.code ?? '')
    setKind(draft.edit?.kind ?? 'Team')
    setParent(draft.edit?.parent ?? draft.parent ?? '')
  }, [draft])
  const editing = draft?.edit

  function save() {
    const n = name.trim()
    if (!n) return toast('A unit needs a name', { ok: false })
    if (editing) {
      if (parent === editing.id) return toast('A unit cannot sit inside itself', { ok: false })
      if (unitDescendants(units, editing.id).some((u) => u.id === parent)) return toast('That would put the unit inside its own child', { ok: false })
      actions.update(editing.id, { name: n, code: code.trim() || editing.code, kind, parent: parent || null })
      toast(`${n} updated`)
      onSaved(editing.id)
    } else {
      const id = actions.create({ name: n, code: code.trim() || n.slice(0, 3).toUpperCase(), kind, parent: parent || null })
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
            <FieldLabel>Kind</FieldLabel>
            <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as Unit['kind'])} className="[&>select]:h-10">
              {UNIT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Sits under</FieldLabel>
            <NativeSelect value={parent} onChange={(e) => setParent(e.target.value)} className="[&>select]:h-10">
              <option value="">Top level — no parent</option>
              {liveUnits(units).filter((u) => u.id !== editing?.id).map((u) => (
                <option key={u.id} value={u.id}>
                  {unitPath(units, u.id, ' › ')}
                </option>
              ))}
            </NativeSelect>
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

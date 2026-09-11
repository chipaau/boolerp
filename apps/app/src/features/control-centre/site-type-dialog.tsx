import { useEffect, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { Switch } from '@workspace/ui/components/switch'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { CADENCES, MODES, modeHint } from '@/features/org/logic'
import { useSiteTypeActions, useSiteTypes, useSites } from '@/features/org/queries'
import type { Cadence, SiteType, StorageMode } from '@/features/org/types'
import { FieldLabel, fieldClass } from './control-bits'

/** New or edited site type: storage mode, issuing, bins, the counting default and negative stock. */
export function SiteTypeDialog({ draft, onClose, onSaved }: { draft: { edit?: SiteType } | null; onClose: () => void; onSaved: (id: string) => void }) {
  const types = useSiteTypes(), sites = useSites()
  const actions = useSiteTypeActions()
  const toast = useToast()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<StorageMode>('Storage')
  const [desc, setDesc] = useState('')
  const [issue, setIssue] = useState(true)
  const [bins, setBins] = useState(true)
  const [negative, setNegative] = useState(false)
  const [cadence, setCadence] = useState<Cadence>('Monthly')
  useEffect(() => {
    if (!draft) return
    const t = draft.edit
    setName(t?.name ?? ''); setMode(t?.mode ?? 'Storage'); setDesc(t?.desc ?? ''); setIssue(t?.issue ?? true); setBins(t?.bins ?? true); setNegative(t?.negative ?? false); setCadence(t?.cadence ?? 'Monthly')
  }, [draft])
  const editing = draft?.edit
  const inUse = editing ? sites.filter((s) => s.typeId === editing.id).length : 0
  const none = mode === 'None'

  function pickMode(m: StorageMode) {
    setMode(m)
    if (m === 'None') { setIssue(false); setBins(false); setCadence('None') }
  }
  function save() {
    const n = name.trim()
    if (!n) return toast('Give the site type a name', { ok: false })
    const d = desc.trim() || modeHint(mode)
    if (editing) {
      const diffs: string[] = []
      if (editing.name !== n) diffs.push(`renamed from ${editing.name}`)
      if (editing.mode !== mode) diffs.push(`storage ${editing.mode.toLowerCase()} → ${mode.toLowerCase()}`)
      if (editing.issue !== issue) diffs.push(`issuing ${issue ? 'allowed' : 'blocked'}`)
      if (editing.bins !== bins) diffs.push(`bin tracking ${bins ? 'on' : 'off'}`)
      if (editing.cadence !== cadence) diffs.push(`counts ${cadence === 'None' ? 'stopped' : cadence.toLowerCase()}`)
      if (editing.negative !== negative) diffs.push(`negative stock ${negative ? 'allowed' : 'blocked'}`)
      actions.update(editing.id, { name: n, mode, desc: d, issue, bins, negative, cadence }, `${n} · ${diffs.length ? diffs.join(', ') : 'description updated'}`)
      toast(`${n} updated${inUse ? ` · ${inUse} ${inUse === 1 ? 'site follows' : 'sites follow'} the new rules` : ''}`)
      onSaved(editing.id)
    } else {
      if (types.some((t) => t.name.toLowerCase() === n.toLowerCase())) return toast('A type with that name already exists', { ok: false })
      const id = actions.create({ name: n, mode, desc: d, issue, bins, negative, cadence })
      toast(`${n} created — no sites use it yet`)
      onSaved(id)
    }
    onClose()
  }

  const row = (label: string, note: string, on: boolean, set: (v: boolean) => void, disabled: boolean) => (
    <label className={cn('flex cursor-pointer items-center gap-3.5 py-3', disabled && 'cursor-not-allowed opacity-50')}>
      <span className="min-w-0 flex-1">
        <span className="block text-ui-sm font-bold text-foreground">{label}</span>
        <span className="mt-0.5 block text-caption leading-[1.45] text-faint">{note}</span>
      </span>
      <Switch checked={on} disabled={disabled} onCheckedChange={set} />
    </label>
  )

  return (
    <Dialog open={draft !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[580px]" showCloseButton>
        <DialogHeader className="px-6 pt-[22px] pb-3 pr-14 text-left">
          <DialogTitle className="text-[19px] tracking-[-0.015em]">{editing ? `Edit ${editing.name}` : 'New site type'}</DialogTitle>
          <DialogDescription className="mt-1 text-compact text-muted-foreground">{editing ? `Changes apply to ${inUse} ${inUse === 1 ? 'site' : 'sites'} straight away.` : 'Used to stamp the same rules onto many sites.'}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-6 pb-2">
          <FieldLabel>Site type name</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Regional warehouse" className={fieldClass} autoFocus />

          <div className="mt-5">
            <FieldLabel>How stock behaves here</FieldLabel>
          </div>
          <div className="flex flex-col gap-[7px]">
            {MODES.map((m) => (
              <button key={m.k} type="button" onClick={() => pickMode(m.k)} className={cn('flex items-start gap-[11px] rounded-xl px-[13px] py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring', mode === m.k ? 'bg-surface-band shadow-[inset_0_0_0_1.5px_var(--sage)]' : 'shadow-[inset_0_0_0_1px_var(--divider)] hover:bg-surface-soft')}>
                <span aria-hidden="true" className={cn('mt-0.5 grid size-[17px] shrink-0 place-items-center rounded-full', mode === m.k ? 'shadow-[inset_0_0_0_1.5px_var(--sage)]' : 'shadow-[inset_0_0_0_1.5px_var(--input)]')}>
                  {mode === m.k && <span className="size-2 rounded-full bg-sage" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-ui-sm font-bold text-foreground">{m.label}</span>
                  <span className="mt-[3px] block text-caption leading-[1.5] text-faint">{m.hint}</span>
                </span>
              </button>
            ))}
          </div>
          {editing && inUse > 0 && editing.mode !== mode && (
            <div className="mt-2.5 rounded-[11px] bg-tone-warning-soft px-[13px] py-2.5 text-compact leading-[1.5] text-tone-warning-foreground">
              Heads up — {inUse} {inUse === 1 ? 'site' : 'sites'} will switch to this behaviour when you save.
            </div>
          )}

          <div className="mt-4 divide-y divide-divider rounded-xl bg-surface-band px-3.5">
            {row('Can issue goods', none ? 'Not available — nothing is held to issue.' : 'Stock can be issued out to jobs, people or other sites.', issue, setIssue, none)}
            {row('Has shelves / bins', none ? 'Not available — nothing is stored to track.' : 'Items are tracked to a bin location inside the site.', bins, setBins, none)}
          </div>

          {!none && (
            <div className="mt-5">
              <FieldLabel>Counting default for its sites</FieldLabel>
              <div className="flex flex-wrap gap-[7px]">
                {CADENCES.map((c) => (
                  <button key={c} type="button" onClick={() => setCadence(c)} className={cn('h-8 rounded-full px-3.5 text-fine font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring', cadence === c ? 'bg-primary text-foreground' : 'text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-surface-soft')}>
                    {c === 'None' ? 'No routine count' : c}
                  </button>
                ))}
              </div>
              <div className="mt-2.5 rounded-[10px] bg-surface-band px-3 py-2.5 text-caption leading-[1.5] text-faint">{cadence === 'None' ? 'Inventory will never schedule a count here — fine for low-value or fast-moving pass-through stock.' : `Inventory schedules a ${cadence.toLowerCase()} cycle count at every site of this type and flags overdue ones.`}</div>
              <div className="mt-3 rounded-xl bg-surface-band px-3.5">{row('Allow stock to go negative', "Lets staff issue goods the system hasn't received yet, and reconcile after. Off means an issue is blocked until stock exists.", negative, setNegative, false)}</div>
            </div>
          )}

          <div className="mt-5">
            <FieldLabel hint=" — optional, shown to staff">Description</FieldLabel>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder={modeHint(mode)} className="w-full resize-y rounded-[10px] bg-surface-band px-[13px] py-[11px] text-compact leading-[1.55] text-foreground outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-[9px] px-6 pt-3 pb-[18px]">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{editing ? 'Save changes' : 'Create site type'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

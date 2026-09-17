import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { Switch } from '@workspace/ui/components/switch'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { useCountries, useRegionActions, useRegions, useSites } from '@/features/org/queries'
import type { Country, Region } from '@/features/org/types'
import { ControlTitle, RuleStrip, useCanEdit } from './control-bits'
import { RegionDialog } from './region-dialog'
import type { RegionDraft } from './region-dialog'

const READ_ONLY = 'Read only as Staff — ask an Admin to change setup'
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * An address is a country, then a region, then a city or island. Countries switch on and off (not
 * while sites sit in them); surveyed countries bring Bool's regions, which stay read-only, and the
 * rest take regions the Admin defines.
 */
export function RegionsPage() {
  const countries = useCountries(), regions = useRegions(), sites = useSites()
  const actions = useRegionActions()
  const canEdit = useCanEdit()
  const toast = useToast()
  const [open, setOpen] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [draft, setDraft] = useState<RegionDraft | null>(null)
  const [removing, setRemoving] = useState<Region | null>(null)

  const on = countries.filter((c) => c.on)
  const mine = regions.filter((g) => g.origin === 'custom').length
  const rows = countries.filter((c) => c.on || c.name === open || showAll)
  const toggleOpen = (name: string) => setOpen((cur) => (cur === name ? '' : name))

  function add(forced?: string) {
    if (!canEdit) return toast(READ_ONLY, { ok: false })
    const eligible = on.filter((c) => !c.seeded).map((c) => c.name)
    const country = forced ?? (eligible.includes(open) ? open : eligible[0])
    if (!country) return toast("Every country you operate in is surveyed by Bool — switch on one it hasn't mapped to define your own regions", { ok: false })
    setOpen(country)
    setDraft({ country })
  }
  function toggle(c: Country) {
    if (!canEdit) return toast(READ_ONLY, { ok: false })
    const used = sites.filter((s) => s.country === c.name).length
    if (c.on && used) return toast(`${used} ${used === 1 ? 'site sits' : 'sites sit'} in ${c.name} — move them before turning it off`, { ok: false })
    actions.toggleCountry(c.id)
    toast(`${c.name} turned ${c.on ? 'off' : 'on'}`)
  }
  function edit(g: Region) {
    if (!canEdit) return toast(READ_ONLY, { ok: false })
    setDraft({ edit: g })
  }
  function del(g: Region) {
    if (!canEdit) return toast(READ_ONLY, { ok: false })
    const used = sites.filter((s) => s.region === g.name && s.country === g.country).length
    if (used) return toast(`${used} ${used === 1 ? 'site is' : 'sites are'} in ${g.name} — move them first`, { ok: false })
    setRemoving(g)
  }

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          overline="System"
          title="Regions"
          description="An address is a country, then a region inside it, then a city or island. Switch on the countries you operate in; open one to see its regions. Where Bool has surveyed a country the regions come with it — everywhere else they are yours to define."
          actions={
            <>
              <Badge variant={showAll ? 'filter-active' : 'filter'} render={<button type="button" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)} />}>
                {showAll ? 'Showing every country' : 'Show all countries'}
              </Badge>
              <Button onClick={() => add()}>
                Add region
                <ButtonArrow>
                  <Plus strokeWidth={2.2} />
                </ButtonArrow>
              </Button>
            </>
          }
        />
        <RuleStrip>
          {plural(regions.length, 'region', 'regions')} across {plural(on.length, 'country', 'countries')} · Bool has surveyed {on.filter((c) => c.seeded).length} of them · {plural(mine, 'region', 'regions')} you defined
        </RuleStrip>

        <Card className="gap-0 overflow-clip py-0">
          {rows.map((c) => {
            const isOpen = c.name === open
            const regs = regions.filter((g) => g.country === c.name)
            const used = sites.filter((s) => s.country === c.name).length
            return (
              <div key={c.id} className={cn('border-b border-divider last:border-b-0', isOpen && 'bg-surface-soft')}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => toggleOpen(c.name)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
                    e.preventDefault()
                    toggleOpen(c.name)
                  }}
                  className={cn('flex cursor-pointer flex-wrap items-center gap-3.5 px-5 py-3.5 outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', !c.on && 'opacity-60')}
                >
                  {/* the switch sits inside the clickable row, so it must not also expand it */}
                  <span className="flex" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Switch checked={c.on} aria-label={`${c.name} ${c.on ? 'on' : 'off'}`} onCheckedChange={() => toggle(c)} />
                  </span>
                  <span className="shrink-0 rounded-[7px] bg-surface-band px-[9px] py-[5px] font-mono text-xs font-bold text-foreground">{c.code}</span>
                  <span className="min-w-0 flex-[1_1_160px]">
                    <span className={cn('block text-ui text-foreground', isOpen ? 'font-extrabold' : 'font-bold')}>{c.name}</span>
                    <span className="mt-[3px] block text-caption text-faint">
                      {c.tz} · {c.cur} · {regs.length ? plural(regs.length, 'region', 'regions') : 'no regions yet'}
                    </span>
                  </span>
                  <span className="shrink-0 text-compact text-body">{used ? plural(used, 'site', 'sites') : 'no sites'}</span>
                  {isOpen && !c.seeded && c.on && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        add(c.name)
                      }}
                    >
                      Add region
                    </Button>
                  )}
                  {isOpen ? <ChevronDown className="size-3.5 shrink-0 text-faint" strokeWidth={1.8} /> : <ChevronRight className="size-3.5 shrink-0 text-faint" strokeWidth={1.8} />}
                </div>
                {isOpen && (
                  <div className="px-5 pb-4">
                    {regs.map((g) => {
                      const inUse = sites.filter((s) => s.region === g.name && s.country === g.country).length
                      return (
                        <div key={g.id} className="flex flex-wrap items-center gap-3.5 border-t border-divider py-[11px]">
                          <span className="min-w-0 flex-[1_1_150px]">
                            <span className="block text-ui-sm font-bold text-foreground">{g.name}</span>
                            <span className="mt-1 block text-caption leading-[1.5] text-faint">
                              {g.places.join(' · ')}
                              {inUse > 0 && `  —  ${plural(inUse, 'site', 'sites')}`}
                            </span>
                          </span>
                          {g.origin === 'custom' && (
                            <span className="flex items-center gap-[7px]">
                              <Button variant="outline" size="xs" onClick={() => edit(g)}>
                                Edit
                              </Button>
                              <Button variant="outline" size="xs" className="text-tone-risk-foreground" onClick={() => del(g)}>
                                Delete
                              </Button>
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {regs.length === 0 && (
                      <div className="pt-1 pb-0.5 text-compact leading-[1.55] text-pretty text-body">
                        {c.seeded ? `Bool hasn't published regions for ${c.name} yet.` : c.on ? 'No regions here yet. Add one — a province, an emirate, an operating zone — and list the cities inside it.' : `Switch ${c.name} on to define its regions.`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      </div>
      <RegionDialog draft={draft} onClose={() => setDraft(null)} onSaved={setOpen} />
      <ConfirmDialog
        open={removing !== null}
        title={`Delete ${removing?.name ?? 'region'}?`}
        description="No sites sit in it, so it can go straight away."
        action="Delete region"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return
          const undo = actions.remove(removing.id)
          toast(`${removing.name} removed`, { undo: () => { undo(); toast(`${removing.name} is back`) } })
          setRemoving(null)
        }}
      />
    </div>
  )
}

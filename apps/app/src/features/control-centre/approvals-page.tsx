import { Fragment, useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { EmptyState } from '@workspace/ui/components/empty-state'
import { useToast } from '@workspace/ui/components/toast'
import { fmtIsoDay, personById } from '@/features/org/logic'
import { useApprovalChainActions, useApprovalChains, usePeople, useUnits } from '@/features/org/queries'
import type { ApprovalChain } from '@/features/org/types'
import { ApprovalChainDialog, stepInfo } from './approval-chain-dialog'
import { ControlTitle, RuleStrip, useIsAdmin } from './control-bits'

const processes = (n: number) => `${n} ${n === 1 ? 'process' : 'processes'}`

/** Who signs off, in what order, and above what value — apps point their actions at a chain. */
export function ApprovalsPage() {
  const chains = useApprovalChains(), people = usePeople(), units = useUnits()
  const actions = useApprovalChainActions()
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const [draft, setDraft] = useState<{ edit?: ApprovalChain } | null>(null)
  const [removing, setRemoving] = useState<ApprovalChain | null>(null)
  const denied = () => toast('Only Admins change approval chains', { ok: false })
  const wired = chains.filter((c) => c.used.length).length

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          overline="System"
          title="Approval chains"
          description="Who signs off, in what order, and above what value. Control Centre holds the chain; each app decides which of its actions points at it — so a chain here is never tied to one app's rules."
          actions={
            <Button onClick={() => (isAdmin ? setDraft({}) : denied())}>
              New chain
              <ButtonArrow>
                <Plus strokeWidth={2.2} />
              </ButtonArrow>
            </Button>
          }
        />
        <RuleStrip>
          {chains.length} {chains.length === 1 ? 'chain' : 'chains'} · {wired} wired into an app process · apps decide what triggers them, Control Centre decides who signs
        </RuleStrip>

        {chains.length ? (
          <div className="flex flex-col gap-3">
            {chains.map((c) => {
              const cover = personById(people, c.standIn)
              return (
                <Card key={c.id} className="gap-0 px-[22px] py-[18px]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-base font-bold tracking-[-0.01em] text-foreground">{c.name}</span>
                        <Badge variant={c.threshold === 'Any' ? 'neutral' : 'warning'} size="sm">
                          {c.threshold === 'Any' ? 'Every request' : `Above ${c.threshold}`}
                        </Badge>
                      </div>
                      {c.standIn && (
                        <div className="mt-[11px]">
                          <Badge variant="success" size="sm">
                            Standing in: {cover?.name ?? c.standIn}
                            {c.standInUntil ? ` until ${fmtIsoDay(c.standInUntil)}` : ''}
                          </Badge>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {c.steps.map((s, i) => {
                          const info = stepInfo(s, people, units)
                          return (
                            <Fragment key={i}>
                              <span title={info.sub} className="inline-flex h-[22px] items-center rounded-full bg-surface-soft px-2.5 text-fine font-bold text-body">
                                {i + 1}. {info.label}
                              </span>
                              {i < c.steps.length - 1 && <span aria-hidden="true" className="text-caption text-faint">→</span>}
                            </Fragment>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-[7px]">
                      <Button variant="outline" size="sm" onClick={() => (isAdmin ? setDraft({ edit: c }) : denied())}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-tone-risk-foreground"
                        onClick={() => {
                          if (!isAdmin) return denied()
                          if (c.used.length) return toast(`Used by ${processes(c.used.length)} — detach it first`, { ok: false })
                          setRemoving(c)
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="mt-[15px] border-t border-divider pt-3.5">
                    <div className="mb-[7px] text-caption text-faint">{c.used.length ? 'Used by' : 'Not pointed at by any process yet — an app has to opt in'}</div>
                    {c.used.length > 0 && (
                      <div className="flex flex-wrap items-center gap-[7px]">
                        {c.used.map((u) => (
                          <span key={u} className="rounded-full bg-surface-band px-[11px] py-[5px] text-caption font-medium text-body">
                            {u}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <EmptyState title="No approval chains yet" description="Create one, then point an app's actions at it." className="py-24" />
        )}
      </div>
      <ApprovalChainDialog draft={draft} onClose={() => setDraft(null)} />
      <ConfirmDialog
        open={removing !== null}
        title={`Delete ${removing?.name ?? 'chain'}?`}
        description="No process points at this chain, so it can go straight away."
        action="Delete chain"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return
          const c = removing
          const undo = actions.remove(c.id)
          setRemoving(null)
          toast(`${c.name} deleted`, { undo: () => { undo(); toast(`${c.name} is back`) } })
        }}
      />
    </div>
  )
}

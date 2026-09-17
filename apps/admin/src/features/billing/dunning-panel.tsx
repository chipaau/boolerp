import { Minus, Plus } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Segmented, SegmentedItem } from '@workspace/ui/components/segmented'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { useBillingActions, useBillingOptions, useDunningPolicy } from './queries'

const DOT = { r1: 'bg-tone-success', r2: 'bg-tone-success', warn: 'bg-tone-warning', susp: 'bg-tone-risk' } as const

/** Platform dunning policy: day offsets per step and the auto-suspend switch. */
export function DunningPanel() {
  const policy = useDunningPolicy()
  const { dunningSteps } = useBillingOptions()
  const { setDunningDay, setAutoSuspend } = useBillingActions()
  const toast = useToast()

  const toggleAuto = (auto: boolean) => {
    if (auto === policy.auto) return
    const undo = setAutoSuspend(auto)
    toast(auto ? `Auto-suspend on at day +${policy.susp}.` : 'Auto-suspend off — overdue tenants keep their access.', { undo })
  }

  return (
    <Card className="mb-[18px] animate-rise gap-0 px-[22px] pt-5 pb-3">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3.5">
        <div className="min-w-0">
          <div className="text-ui font-bold text-foreground">Dunning policy</div>
          <div className="mt-1 text-caption text-muted-foreground">What happens, and when, after an invoice passes its due date.</div>
        </div>
        <Segmented aria-label="Auto-suspend">
          <SegmentedItem active={policy.auto} onClick={() => toggleAuto(true)}>
            {policy.auto ? 'Auto-suspend is on' : 'Turn on'}
          </SegmentedItem>
          <SegmentedItem active={!policy.auto} onClick={() => toggleAuto(false)}>
            {policy.auto ? 'Turn off' : 'Auto-suspend is off'}
          </SegmentedItem>
        </Segmented>
      </div>
      {dunningSteps.map((step) => {
        const muted = step.key === 'susp' && !policy.auto
        return (
          <div key={step.key} className={cn('flex items-center gap-3.5 border-b border-divider py-3', muted && 'opacity-55')}>
            <span aria-hidden="true" className={cn('size-[7px] shrink-0 rounded-full', DOT[step.key])} />
            <div className="min-w-0 flex-1">
              <div className="text-ui-sm font-bold text-foreground">{step.label}</div>
              <div className="mt-0.5 text-meta text-muted-foreground">{step.note}</div>
            </div>
            <Button variant="outline" size="icon-xs" aria-label={`Earlier ${step.label.toLowerCase()}`} onClick={() => setDunningDay(step.key, policy[step.key] - 1)}>
              <Minus />
            </Button>
            <span className={cn('min-w-[58px] text-center text-caption font-bold tabular-nums', muted ? 'text-faint' : 'text-body')}>Day +{policy[step.key]}</span>
            <Button variant="outline" size="icon-xs" aria-label={`Later ${step.label.toLowerCase()}`} onClick={() => setDunningDay(step.key, policy[step.key] + 1)}>
              <Plus />
            </Button>
          </div>
        )
      })}
      <div className="pt-3">
        <Button variant="outline" size="sm" onClick={() => toast('Dunning policy updated. Tenants with their own override keep it.')}>
          Apply to every tenant
        </Button>
      </div>
    </Card>
  )
}

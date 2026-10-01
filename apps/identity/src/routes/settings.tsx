import { createFileRoute } from '@tanstack/react-router'
import { Settings } from '@ory/elements-react/theme'
import { oryConfig } from '@/lib/kratos'
import { useFlow, validateFlowSearch } from '@/lib/use-flow'
import { AccountShell, boolComponents } from '@/theme/bool'
import { FlowUnavailable } from '@/theme/flow-unavailable'

export const Route = createFileRoute('/settings')({
  validateSearch: validateFlowSearch,
  component: Page,
})

function Page() {
  const { flow: flowId, return_to } = Route.useSearch()
  const { flow, failed } = useFlow('settings', flowId, return_to)
  if (failed) return <FlowUnavailable />
  if (!flow) return null
  return (
    <AccountShell>
      <Settings flow={flow} config={oryConfig} components={boolComponents} />
    </AccountShell>
  )
}

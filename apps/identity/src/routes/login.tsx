import { createFileRoute } from '@tanstack/react-router'
import { Login } from '@ory/elements-react/theme'
import { oryConfig } from '@/lib/kratos'
import { useFlow, validateFlowSearch } from '@/lib/use-flow'
import { boolComponents } from '@/theme/bool'
import { FlowUnavailable } from '@/theme/flow-unavailable'

export const Route = createFileRoute('/login')({
  validateSearch: validateFlowSearch,
  component: Page,
})

function Page() {
  const { flow: flowId, return_to } = Route.useSearch()
  const { flow, failed } = useFlow('login', flowId, return_to)
  if (failed) return <FlowUnavailable />
  if (!flow) return null
  return <Login flow={flow} config={oryConfig} components={boolComponents} />
}

import { loadFlow, oryConfig, type FlowSearch } from '@/lib/kratos'
import { RecoveryView } from '@/components/flows'

export default async function Page({ searchParams }: { searchParams: FlowSearch }) {
  const { flow: id, return_to } = await searchParams
  const flow = await loadFlow('recovery', id, return_to)
  return <RecoveryView flow={flow} config={oryConfig()} />
}

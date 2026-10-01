import { loadFlow, oryConfig, type FlowSearch } from '@/lib/kratos'
import { VerificationView } from '@/components/flows'

export default async function Page({ searchParams }: { searchParams: FlowSearch }) {
  const { flow: id, return_to } = await searchParams
  const flow = await loadFlow('verification', id, return_to)
  return <VerificationView flow={flow} config={oryConfig()} />
}

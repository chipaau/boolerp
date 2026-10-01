import { loadFlow, oryConfig, type FlowSearch } from '@/lib/kratos'
import { LoginView } from '@/components/flows'

export default async function Page({ searchParams }: { searchParams: FlowSearch }) {
  const { flow: id, return_to } = await searchParams
  const flow = await loadFlow('login', id, return_to)
  return <LoginView flow={flow} config={oryConfig()} />
}

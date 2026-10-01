import { loadFlow, oryConfig, type FlowSearch } from '@/lib/kratos'
import { RegistrationView } from '@/components/flows'

export default async function Page({ searchParams }: { searchParams: FlowSearch }) {
  const { flow: id, return_to } = await searchParams
  const flow = await loadFlow('registration', id, return_to)
  return <RegistrationView flow={flow} config={oryConfig()} />
}

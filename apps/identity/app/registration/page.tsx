import { loadFlow, oryConfig, type FlowSearch } from '@/lib/kratos'
import { RegistrationView } from '@/components/flows'

export default async function Page({ searchParams }: { searchParams: FlowSearch }) {
  const { flow: id, return_to, login_challenge } = await searchParams
  const flow = await loadFlow('registration', id, return_to, login_challenge)
  return <RegistrationView flow={flow} config={oryConfig()} />
}

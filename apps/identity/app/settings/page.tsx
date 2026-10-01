import { loadFlow, logoutUrl, oryConfig, type FlowSearch } from '@/lib/kratos'
import { SettingsView } from '@/components/flows'

export default async function Page({ searchParams }: { searchParams: FlowSearch }) {
  const { flow: id, return_to } = await searchParams
  const flow = await loadFlow('settings', id, return_to)
  return <SettingsView flow={flow} config={oryConfig()} logoutUrl={await logoutUrl()} />
}

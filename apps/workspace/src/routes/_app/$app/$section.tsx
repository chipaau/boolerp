import { createFileRoute } from '@tanstack/react-router'
import { getScreen } from '@/features/screens'
import { findMenuItem, getApp } from '@/lib/apps'
import { ProtoPage } from '@/proto/proto-page'

export const Route = createFileRoute('/_app/$app/$section')({
  // Optional deep-link params shared by list/table pages: a date (Home heat map -> Task), a
  // preset filter / query (saved views, KPI links), and a record id (Calendar meeting detail).
  validateSearch: (s: Record<string, unknown>): { date?: string; filter?: string; q?: string; id?: string } => ({
    id: typeof s.id === 'string' ? s.id : undefined,
    date: typeof s.date === 'string' ? s.date : undefined,
    filter: typeof s.filter === 'string' ? s.filter : undefined,
    q: typeof s.q === 'string' ? s.q : undefined,
  }),
  // real screens read data with suspense queries; this boundary keeps the shell around them mounted
  wrapInSuspense: true,
  component: AppSection,
})

function AppSection() {
  const { app, section } = Route.useParams()
  const cfg = getApp(app)!
  const Screen = getScreen(app, section)
  if (Screen) return <Screen />
  const item = findMenuItem(cfg, section) ?? { title: section, slug: section }
  return <ProtoPage app={cfg} item={item} />
}

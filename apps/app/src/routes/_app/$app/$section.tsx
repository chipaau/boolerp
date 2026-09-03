import { createFileRoute } from '@tanstack/react-router'
import { getScreen } from '@/features/screens'
import { findMenuItem, getApp } from '@/lib/apps'
import { ProtoPage } from '@/proto/proto-page'

export const Route = createFileRoute('/_app/$app/$section')({
  // Optional deep-link params shared by list/table pages: a date (Home heat map -> Task), and a
  // preset filter / query (saved views, KPI links).
  validateSearch: (s: Record<string, unknown>): { date?: string; filter?: string; q?: string } => ({
    date: typeof s.date === 'string' ? s.date : undefined,
    filter: typeof s.filter === 'string' ? s.filter : undefined,
    q: typeof s.q === 'string' ? s.q : undefined,
  }),
  component: AppSection,
})

function AppSection() {
  const { app, section } = Route.useParams()
  const cfg = getApp(app)!
  const Screen = getScreen(app, section)
  if (Screen) return <Screen />
  const item = findMenuItem(cfg, section) ?? { title: section, slug: section, variant: 'table' as const }
  return <ProtoPage app={cfg} item={item} />
}

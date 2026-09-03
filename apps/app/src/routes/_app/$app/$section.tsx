import { createFileRoute } from '@tanstack/react-router'
import { findMenuItem, getApp } from '@/lib/apps'
import { ProtoPage } from '@/proto/proto-page'

export const Route = createFileRoute('/_app/$app/$section')({
  // Optional deep-link filters shared by list/table pages (e.g. Home heat map -> Task for a day).
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: typeof search.date === 'string' ? search.date : undefined,
  }),
  component: AppSection,
})

function AppSection() {
  const { app, section } = Route.useParams()
  const cfg = getApp(app)!
  const item = findMenuItem(cfg, section) ?? { title: section, slug: section, variant: 'table' as const }
  return <ProtoPage app={cfg} item={item} />
}

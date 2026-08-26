import { createFileRoute } from '@tanstack/react-router'
import { findMenuItem, getApp } from '@/lib/apps'
import { ProtoPage } from '@/proto/proto-page'

export const Route = createFileRoute('/_app/$app/$section')({
  component: AppSection,
})

function AppSection() {
  const { app, section } = Route.useParams()
  const cfg = getApp(app)!
  const item = findMenuItem(cfg, section) ?? { title: section, slug: section, variant: 'table' as const }
  return <ProtoPage app={cfg} item={item} />
}

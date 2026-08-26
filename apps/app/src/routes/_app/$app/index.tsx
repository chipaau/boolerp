import { createFileRoute } from '@tanstack/react-router'
import { findMenuItem, getApp } from '@/lib/apps'
import { ProtoPage } from '@/proto/proto-page'

export const Route = createFileRoute('/_app/$app/')({
  component: AppHome,
})

function AppHome() {
  const { app } = Route.useParams()
  const cfg = getApp(app)!
  const home = findMenuItem(cfg, '') ?? cfg.menu[0].items[0]
  return <ProtoPage app={cfg} item={home} />
}

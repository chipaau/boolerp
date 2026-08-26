import { createFileRoute } from '@tanstack/react-router'
import { PageHeader, PlaceholderContent } from '@/components/layout/page'
import { getApp } from '@/lib/apps'

export const Route = createFileRoute('/_app/$app/')({
  component: AppHome,
})

function AppHome() {
  const { app } = Route.useParams()
  const cfg = getApp(app)!
  return (
    <>
      <PageHeader title={cfg.name} description={cfg.description} />
      <PlaceholderContent label={`${cfg.name} overview`} />
    </>
  )
}

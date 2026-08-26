import { createFileRoute } from '@tanstack/react-router'
import { PageHeader, PlaceholderContent } from '@/components/layout/page'
import { getApp } from '@/lib/apps'

export const Route = createFileRoute('/_app/$app/$section')({
  component: AppSection,
})

function AppSection() {
  const { app, section } = Route.useParams()
  const cfg = getApp(app)!
  const item = cfg.menu.flatMap((s) => s.items).find((i) => i.slug === section)
  const title = item?.title ?? section
  return (
    <>
      <PageHeader title={title} description={cfg.name} />
      <PlaceholderContent label={title} />
    </>
  )
}

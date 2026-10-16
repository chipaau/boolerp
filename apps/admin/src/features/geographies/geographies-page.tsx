import { useNavigate } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { PageTitle } from '@/components/layout/page'
import type { GeographiesTab } from './schemas'

/** Where each tab lives: the tab is the path, so it can be linked to and survives a reload (C218). */
const TAB_PATHS = {
  geographies: '/geographies/geographies',
  countries: '/geographies/countries',
  'geography-types': '/geographies/geography-types',
} as const

/**
 * The geographies screen's title and tabs, which each tab's page renders above its own list: the
 * tab is the path (C218), and each list keeps its own search in the URL (C174).
 */
export function GeographiesHeader({ tab, meta, actions }: { tab: GeographiesTab; meta: string; actions?: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <>
      <PageTitle overline="Admin" title="Geographies" meta={meta} actions={actions} className="mb-[18px]" />
      <Tabs value={tab} onValueChange={(v) => void navigate({ to: TAB_PATHS[v as GeographiesTab] })} className="mb-4 gap-0">
        <TabsList>
          <TabsTrigger value="geographies">Geographies</TabsTrigger>
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="geography-types">Geography types</TabsTrigger>
        </TabsList>
      </Tabs>
    </>
  )
}

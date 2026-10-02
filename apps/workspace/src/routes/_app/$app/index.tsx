import { createFileRoute } from '@tanstack/react-router'
import { getScreen } from '@/features/screens'
import { findMenuItem, getApp } from '@/lib/apps'
import { ProtoPage } from '@/proto/proto-page'

export type AppHomeSearch = { view?: string; date?: string; hide?: string; mine?: 'true'; declined?: 'true'; scope?: string; sort?: string; q?: string; id?: string }

export const Route = createFileRoute('/_app/$app/')({
  // Optional view state an app home may keep in the URL (Calendar: view, selected day, hidden
  // calendars, filters; Directory: scope, sort, query, open record) so it survives reloads and
  // can be linked to.
  validateSearch: (s: Record<string, unknown>): AppHomeSearch => ({
    view: typeof s.view === 'string' ? s.view : undefined,
    date: typeof s.date === 'string' ? s.date : undefined,
    hide: typeof s.hide === 'string' ? s.hide : undefined,
    mine: s.mine === 'true' || s.mine === true ? 'true' : undefined,
    declined: s.declined === 'true' || s.declined === true ? 'true' : undefined,
    scope: typeof s.scope === 'string' ? s.scope : undefined,
    sort: typeof s.sort === 'string' ? s.sort : undefined,
    q: typeof s.q === 'string' ? s.q : undefined,
    id: typeof s.id === 'string' ? s.id : undefined,
  }),
  wrapInSuspense: true,
  component: AppHome,
})

function AppHome() {
  const { app } = Route.useParams()
  const cfg = getApp(app)!
  const Screen = getScreen(app, '')
  if (Screen) return <Screen />
  const home = findMenuItem(cfg, '') ?? cfg.menu[0].items[0]
  return <ProtoPage app={cfg} item={home} />
}

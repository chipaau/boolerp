import { createFileRoute } from '@tanstack/react-router'
import { SiteTypesPage } from '../features/sites'
import { validateControlSearch } from '../features/shared'

export const Route = createFileRoute('/_app/control-centre/site-types')({
  validateSearch: validateControlSearch,
  // the page reads its data with suspense queries; this keeps the shell around it mounted
  wrapInSuspense: true,
  component: SiteTypesPage,
})

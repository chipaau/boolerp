import { createFileRoute } from '@tanstack/react-router'
import { SitesPage } from '../features/sites'
import { validateControlSearch } from '../features/shared'

export const Route = createFileRoute('/_app/control-centre/sites')({
  validateSearch: validateControlSearch,
  // the page reads its data with suspense queries; this keeps the shell around it mounted
  wrapInSuspense: true,
  component: SitesPage,
})

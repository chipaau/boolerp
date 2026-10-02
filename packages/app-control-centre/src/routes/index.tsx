import { createFileRoute } from '@tanstack/react-router'
import { ControlOverviewPage } from '../features/overview'
import { validateControlSearch } from '../features/shared'

export const Route = createFileRoute('/_app/control-centre/')({
  validateSearch: validateControlSearch,
  // the page reads its data with suspense queries; this keeps the shell around it mounted
  wrapInSuspense: true,
  component: ControlOverviewPage,
})

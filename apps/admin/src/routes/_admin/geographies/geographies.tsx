import { createFileRoute } from '@tanstack/react-router'
import { GeographiesPlacesPage } from '@/features/geographies/geographies-page'

// The geographies tab (C218): the shared places, still the design prototype's fixtures.
export const Route = createFileRoute('/_admin/geographies/geographies')({
  component: GeographiesPlacesPage,
})

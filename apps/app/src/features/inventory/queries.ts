// The Inventory data seam. Components read data only through these hooks; the query functions are
// the single place that changes at integration (fixture → generated API client). One hook per
// resource, keyed under ['inventory', …] so the whole app can be invalidated at once.
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import * as mock from './mock'
import type { Period } from './types'

const key = (...parts: (string | number)[]) => ['inventory', ...parts] as const

export const itemsQuery = () => queryOptions({ queryKey: key('items'), queryFn: async () => mock.ITEMS })
export const stockSeriesQuery = (period: Period) =>
  queryOptions({ queryKey: key('stock-series', period), queryFn: async () => mock.SERIES[period] })
export const lowStockQuery = () => queryOptions({ queryKey: key('low-stock'), queryFn: async () => mock.LOW_STOCK })
export const categoriesQuery = () => queryOptions({ queryKey: key('categories'), queryFn: async () => mock.CATEGORIES })
export const approvalsQuery = () => queryOptions({ queryKey: key('approvals'), queryFn: async () => mock.APPROVALS })
export const movementsQuery = () => queryOptions({ queryKey: key('movements'), queryFn: async () => mock.MOVEMENTS })
export const overviewStatsQuery = () => queryOptions({ queryKey: key('overview'), queryFn: async () => mock.OVERVIEW })

export const useItems = () => useSuspenseQuery(itemsQuery()).data
export const useStockSeries = (period: Period) => useSuspenseQuery(stockSeriesQuery(period)).data
export const useLowStock = () => useSuspenseQuery(lowStockQuery()).data
export const useCategories = () => useSuspenseQuery(categoriesQuery()).data
export const useApprovals = () => useSuspenseQuery(approvalsQuery()).data
export const useMovements = () => useSuspenseQuery(movementsQuery()).data
export const useOverviewStats = () => useSuspenseQuery(overviewStatsQuery()).data

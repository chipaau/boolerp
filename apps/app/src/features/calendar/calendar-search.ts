import { useNavigate, useSearch } from '@tanstack/react-router'
import { toIso } from './logic'
import type { CalendarKey, CalendarView } from './types'

/** Board state kept in the URL: which view, which day, hidden calendars and the two filters. */
export type BoardView = CalendarView | 'awaiting'
const VIEW_KEYS: BoardView[] = ['day', 'month', 'week', 'agenda', 'rooms', 'awaiting']

export function useCalendarSearch() {
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const view: BoardView = VIEW_KEYS.includes(search.view as BoardView) ? (search.view as BoardView) : 'month'
  const date = search.date && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : toIso(new Date())
  const hidden = (search.hide?.split(',').filter(Boolean) ?? []) as CalendarKey[]
  const mine = search.mine === 'true'
  const declined = search.declined === 'true'

  function set(patch: Partial<{ view: BoardView; date: string; hidden: CalendarKey[]; mine: boolean; declined: boolean }>) {
    const next = {
      view: patch.view ?? view,
      date: patch.date ?? date,
      hide: (patch.hidden ?? hidden).join(',') || undefined,
      mine: (patch.mine ?? mine) ? ('true' as const) : undefined,
      declined: (patch.declined ?? declined) ? ('true' as const) : undefined,
    }
    void navigate({ to: '/$app', params: { app: 'calendar' }, search: next })
  }
  return { view, date, hidden, mine, declined, set }
}

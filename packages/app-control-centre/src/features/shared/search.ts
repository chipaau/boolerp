/** The URL state Control Centre's pages share: an open record, a preset filter, a query, a date. */
export type ControlSearch = { id?: string; date?: string; filter?: string; q?: string }

/** validateSearch for Control Centre's routes: keeps the known string params, drops the rest. */
export function validateControlSearch(s: Record<string, unknown>): ControlSearch {
  const text = (v: unknown) => (typeof v === 'string' ? v : undefined)
  return { id: text(s.id), date: text(s.date), filter: text(s.filter), q: text(s.q) }
}

/**
 * Query keys for one resource (C175): `all` for everything about it, `lists()` for every list,
 * `list(params)` for one, `details()` and `detail(id)` likewise. Invalidating `lists()` refreshes
 * every page and filter at once.
 */
export function createKeys<const Scope extends readonly string[]>(...scope: Scope) {
  const all = scope
  return {
    all,
    lists: () => [...all, 'list'] as const,
    list: <P>(params: P) => [...all, 'list', params] as const,
    details: () => [...all, 'detail'] as const,
    detail: (id: string) => [...all, 'detail', id] as const,
  }
}

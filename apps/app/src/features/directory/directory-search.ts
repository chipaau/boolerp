import { useNavigate, useSearch } from '@tanstack/react-router'

/** What the list is scoped to: everyone, people away now, one unit (and everything under it), or one manager's team. */
export type Scope = { kind: 'all' } | { kind: 'away' } | { kind: 'group'; id: string } | { kind: 'mgr'; id: string }
export type Sort = 'name' | 'team'

export const scopeToParam = (s: Scope) => (s.kind === 'all' ? undefined : s.kind === 'away' ? 'away' : `${s.kind}:${s.id}`)
export function parseScope(v: string | undefined): Scope {
  if (v === 'away') return { kind: 'away' }
  const m = /^(group|mgr):(.+)$/.exec(v ?? '')
  return m ? { kind: m[1] as 'group' | 'mgr', id: m[2] } : { kind: 'all' }
}

/** List state kept in the URL so the rail, the list and a shared link never disagree. */
export function useDirectorySearch() {
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const scope = parseScope(search.scope)
  const sort: Sort = search.sort === 'team' ? 'team' : 'name'
  const q = search.q ?? ''
  const id = search.id
  function set(patch: Partial<{ scope: Scope; sort: Sort; q: string; id: string | undefined }>) {
    void navigate({
      to: '/$app',
      params: { app: 'directory' },
      search: {
        scope: scopeToParam(patch.scope ?? scope),
        sort: (patch.sort ?? sort) === 'name' ? undefined : 'team',
        q: (patch.q ?? q) || undefined,
        id: 'id' in patch ? patch.id : id,
      },
      replace: 'q' in patch,
    })
  }
  return { scope, sort, q, id, set }
}

import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type AdminSearch = { query: string; setQuery: (q: string) => void }

const SearchContext = createContext<AdminSearch>({ query: '', setQuery: () => {} })

/**
 * The topbar's search pill text, shared with the screens. As in the design, it is not a command
 * palette: each list (tenants, geographies, admin users) narrows itself by this query on top of
 * its own filters. Provided once by the _admin layout.
 */
export function AdminSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('')
  const value = useMemo(() => ({ query, setQuery }), [query])
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useAdminSearch(): AdminSearch {
  return useContext(SearchContext)
}

/** Case-insensitive "every word appears somewhere in the haystack" match; an empty query matches all. */
export function matchesQuery(haystack: string, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const h = haystack.toLowerCase()
  return words.every((w) => h.includes(w))
}

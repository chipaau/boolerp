import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { ApiError } from './error'
import { decide } from './policy'

/** What a query or mutation may tell the error policy (C185), in its `meta`. */
export type ApiMeta = {
  /** HTTP statuses the caller handles itself, such as 422 for a form or 409 for a dialog. */
  handles?: readonly number[]
  /** For a mutation: keys to refetch when it succeeds, and on a 404 or 409. */
  invalidates?: readonly QueryKey[]
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: ApiMeta
    mutationMeta: ApiMeta
  }
}

/** How the app shows a message: its toast. */
export type Notify = (message: string, options: { reference?: string }) => void

/**
 * Whether a query should try again (C175): network failures, timeouts, and 5xx answers at most
 * twice; never a 4xx, a contract mismatch, or a cancellation. Mutations never retry.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2 || !(error instanceof ApiError)) return false
  if (error.kind === 'network' || error.kind === 'timeout') return true
  return error.kind === 'http' && error.status >= 500
}

/**
 * The app's QueryClient with the one error policy (C185): every query and mutation's failure goes
 * through `decide`, and the app's `notify` (its toast) shows what needs showing. Screens handle
 * only what is specific to them.
 */
export function createQueryClient({ notify }: { notify: Notify }): QueryClient {
  let client: QueryClient
  const act = (error: unknown, action: ReturnType<typeof decide>, invalidates?: readonly QueryKey[]) => {
    if (action.log) console.error('API call failed', error)
    if (action.message) notify(action.message, { reference: action.reference })
    if (action.refetch) for (const queryKey of invalidates ?? []) void client.invalidateQueries({ queryKey })
  }
  client = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) =>
        act(error, decide(error, { operation: 'query', hasData: query.state.data !== undefined, handles: query.meta?.handles })),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        act(error, decide(error, { operation: 'mutation', handles: mutation.meta?.handles }), mutation.meta?.invalidates),
      onSuccess: (_data, _variables, _context, mutation) => {
        for (const queryKey of mutation.meta?.invalidates ?? []) void client.invalidateQueries({ queryKey })
      },
    }),
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  return client
}

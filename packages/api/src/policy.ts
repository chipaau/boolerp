import { ApiError } from './error'

/** What the policy does about one failed call (C185). */
export type ErrorAction = {
  /** A message for a toast, or none (the screen shows the error, or nothing should show). */
  message?: string
  /** The request's reference, shown with the message for support. */
  reference?: string
  /** Refetch the mutation's declared keys (404, 409). */
  refetch?: boolean
  /** Write the error to the console (unexpected shapes and non-API errors). */
  log?: boolean
}

export type ErrorContext = {
  /** A query loads data; a mutation saves. */
  operation: 'query' | 'mutation'
  /** For a query: whether data is already on screen (a background refresh failed). */
  hasData?: boolean
  /** HTTP statuses the query or mutation handles itself (`meta.handles`). */
  handles?: readonly number[]
}

const MESSAGES = {
  forbidden: "You don't have permission to do this.",
  notFound: 'It no longer exists.',
  conflict: 'This was changed by someone else, so it has been reloaded.',
  invalid: 'Some values are not valid.',
  tooMany: 'Too many requests. Try again shortly.',
  unavailable: 'The service is unavailable right now. Try again shortly.',
  network: 'The service could not be reached. Check your connection and try again.',
  timeout: 'The service took too long to answer. Try again shortly.',
  contract: 'Something went wrong reading the answer.',
  unexpected: 'Something went wrong.',
}

/**
 * The one error policy (C185), as a pure function: what to do about `error` from a query or a
 * mutation. A 401 never reaches it (the fetch core sends the browser to sign-in first).
 *
 * - Queries: nothing while there is nothing on screen (the screen shows its own state: forbidden,
 *   not found, error with retry); a toast when a refresh fails over data already shown.
 * - Mutations: a toast; 404 and 409 also refetch the mutation's declared keys; 422 stays with the
 *   form when the mutation handles it (`meta.handles`), otherwise a toast.
 * - Aborted calls are ignored; a status the caller handles itself is left to it.
 */
export function decide(error: unknown, ctx: ErrorContext): ErrorAction {
  if (!(error instanceof ApiError)) {
    return ctx.operation === 'query' && !ctx.hasData ? { log: true } : { message: MESSAGES.unexpected, log: true }
  }
  if (error.kind === 'aborted') return {}
  if (error.kind === 'http' && ctx.handles?.includes(error.status)) return {}
  const reference = error.requestId

  if (ctx.operation === 'query') {
    if (!ctx.hasData) return error.kind === 'contract' ? { log: true } : {}
    return { message: messageFor(error), reference, log: error.kind === 'contract' }
  }

  if (error.kind === 'http') {
    switch (error.status) {
      case 403:
        return { message: MESSAGES.forbidden }
      case 404:
        return { message: MESSAGES.notFound, refetch: true }
      case 409:
        return { message: MESSAGES.conflict, refetch: true }
      case 422:
        return { message: error.detail ?? MESSAGES.invalid, reference }
    }
  }
  return { message: messageFor(error), reference, log: error.kind === 'contract' }
}

function messageFor(error: ApiError): string {
  switch (error.kind) {
    case 'network':
      return MESSAGES.network
    case 'timeout':
      return MESSAGES.timeout
    case 'contract':
      return MESSAGES.contract
    default:
      if (error.status === 403) return MESSAGES.forbidden
      if (error.status === 404) return MESSAGES.notFound
      if (error.status === 429) return MESSAGES.tooMany
      if (error.status >= 500) return MESSAGES.unavailable
      return error.detail ?? error.title
  }
}

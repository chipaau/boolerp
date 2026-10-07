import { signIn } from '@workspace/session'
import type { ZodType } from 'zod'
import { ApiError } from './error'

/** How long a call may take before it is abandoned. */
export const TIMEOUT_MS = 30_000

/** A query string's values: empty ones (undefined, null, '') are left out; arrays are joined by commas. */
export type Query = Record<string, string | number | boolean | null | undefined | Array<string | number>>

export type Options<T> = {
  query?: Query
  body?: unknown
  /** TanStack Query's signal, so a cancelled query cancels its request. */
  signal?: AbortSignal
  /** The response's schema: parsed in every environment (C174); no schema means no body is read. */
  schema?: ZodType<T>
}

/** Builds `?a=1&b=x,y` from a query object, skipping empty values. */
export function toSearch(query?: Query): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    params.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

/**
 * The only place the frontend calls fetch (C175, C184): same-origin `/api/...` through the app's
 * BFF, which adds the token. A 401 sends the browser to sign-in and back, before anything else
 * (C185); every other failure is an ApiError, which the query client's one error policy handles.
 */
async function send<T>(method: string, path: string, opts: Options<T> = {}): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error(`API paths start with /api/: ${path}`)
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(path + toSearch(opts.query), {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal,
      credentials: 'same-origin',
    })
  } catch (cause) {
    if (opts.signal?.aborted) throw new ApiError({ kind: 'aborted', title: 'The request was cancelled.', cause })
    if (timeout.aborted) throw new ApiError({ kind: 'timeout', title: 'The service took too long to answer.', cause })
    throw new ApiError({ kind: 'network', title: 'The service could not be reached.', cause })
  }

  const requestId = res.headers.get('X-Request-Id') ?? undefined
  if (res.status === 401) return signIn()
  if (!res.ok) throw await ApiError.fromResponse(res, requestId)
  if (res.status === 204 || !opts.schema) return undefined as T

  let data: unknown
  try {
    data = await res.json()
  } catch (cause) {
    throw new ApiError({ kind: 'contract', status: res.status, title: 'The response was not JSON.', requestId, cause })
  }
  const parsed = opts.schema.safeParse(data)
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    console.error(`API response from ${method} ${path} does not match its schema`, parsed.error.issues)
    throw new ApiError({
      kind: 'contract',
      status: res.status,
      title: 'The response did not have the expected shape.',
      detail: where.join('; '),
      requestId,
      cause: parsed.error,
    })
  }
  return parsed.data
}

/** The API's verbs. Import them only in a feature's `api.ts` (C184). */
export const api = {
  get: <T>(path: string, opts?: Omit<Options<T>, 'body'>) => send<T>('GET', path, opts),
  post: <T>(path: string, opts?: Options<T>) => send<T>('POST', path, opts),
  put: <T>(path: string, opts?: Options<T>) => send<T>('PUT', path, opts),
  patch: <T>(path: string, opts?: Options<T>) => send<T>('PATCH', path, opts),
  delete: <T>(path: string, opts?: Options<T>) => send<T>('DELETE', path, opts),
}

/** What failed (C175): an HTTP answer, the network, the timeout, a cancellation, or a response
 * that did not match its schema. */
export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'aborted' | 'contract'

/** Messages by field path (`owner.email`, `""` for the whole body) or query parameter (`pageSize`). */
export type Messages = Record<string, string[]>

type ProblemFieldError = { pointer?: unknown; parameter?: unknown; code?: unknown; detail?: unknown }

/**
 * Every failure of an API call (C175), built from the API's RFC 9457 problem (C71) when there is
 * one: `fieldErrors` keyed by the dotted path of each JSON Pointer (`#/owner/email` →
 * `owner.email`), `paramErrors` by query parameter, `requestId` for support.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number
  readonly type: string
  readonly title: string
  readonly detail?: string
  readonly requestId?: string
  readonly fieldErrors: Messages
  /** The stable rule codes (`email`, `required`, `max`) by the same keys, for translations later. */
  readonly fieldCodes: Messages
  readonly paramErrors: Messages

  constructor(init: {
    kind: ApiErrorKind
    status?: number
    type?: string
    title: string
    detail?: string
    requestId?: string
    fieldErrors?: Messages
    fieldCodes?: Messages
    paramErrors?: Messages
    cause?: unknown
  }) {
    super(init.detail ?? init.title, { cause: init.cause })
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status ?? 0
    this.type = init.type ?? 'about:blank'
    this.title = init.title
    this.detail = init.detail
    this.requestId = init.requestId
    this.fieldErrors = init.fieldErrors ?? {}
    this.fieldCodes = init.fieldCodes ?? {}
    this.paramErrors = init.paramErrors ?? {}
  }

  /** A 403: the caller may not do this. */
  get forbidden(): boolean {
    return this.kind === 'http' && this.status === 403
  }

  /** Builds the error for a non-2xx response, from its problem body when it has one. */
  static async fromResponse(res: Response, requestId?: string): Promise<ApiError> {
    const body: unknown = await res.json().catch(() => null)
    const problem = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const fieldErrors: Messages = {}
    const fieldCodes: Messages = {}
    const paramErrors: Messages = {}
    const errors = Array.isArray(problem.errors) ? (problem.errors as ProblemFieldError[]) : []
    for (const e of errors) {
      const detail = typeof e.detail === 'string' ? e.detail : 'is invalid'
      if (typeof e.parameter === 'string') {
        ;(paramErrors[e.parameter] ??= []).push(detail)
      } else if (typeof e.pointer === 'string') {
        const path = pointerToPath(e.pointer)
        ;(fieldErrors[path] ??= []).push(detail)
        if (typeof e.code === 'string') (fieldCodes[path] ??= []).push(e.code)
      }
    }
    const instance = typeof problem.instance === 'string' ? problem.instance.replace(/^urn:uuid:/, '') : undefined
    return new ApiError({
      kind: 'http',
      status: res.status,
      type: typeof problem.type === 'string' ? problem.type : 'about:blank',
      title: typeof problem.title === 'string' ? problem.title : res.statusText || `HTTP ${res.status}`,
      detail: typeof problem.detail === 'string' ? problem.detail : undefined,
      requestId: requestId ?? instance,
      fieldErrors,
      fieldCodes,
      paramErrors,
    })
  }
}

/** Turns a JSON Pointer (RFC 6901, as `#/a/0/b`) into a dotted path (`a.0.b`); `#` is `""`. */
export function pointerToPath(pointer: string): string {
  const p = pointer.startsWith('#') ? pointer.slice(1) : pointer
  if (p === '' || p === '/') return ''
  return p
    .replace(/^\//, '')
    .split('/')
    .map((s) => s.replaceAll('~1', '/').replaceAll('~0', '~'))
    .join('.')
}

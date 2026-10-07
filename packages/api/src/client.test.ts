import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { api, toSearch } from './client'
import { ApiError } from './error'

vi.mock('@workspace/session', () => ({ signIn: vi.fn(() => new Promise<never>(() => {})) }))
const { signIn } = await import('@workspace/session')

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
const failure = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => e as ApiError)

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

const thing = z.object({ id: z.string(), name: z.string() })

describe('toSearch', () => {
  it('skips empty values and joins arrays', () => {
    expect(toSearch({ page: 2, q: '', status: undefined, x: null, sort: ['-name', 'code'], on: false })).toBe(
      '?page=2&sort=-name%2Ccode&on=false'
    )
    expect(toSearch({})).toBe('')
    expect(toSearch()).toBe('')
  })
})

describe('api', () => {
  it('calls same-origin /api with the query and parses the response', async () => {
    fetchMock.mockResolvedValue(json(200, { id: '1', name: 'A', extra: true }))
    await expect(api.get('/api/v1/things', { query: { page: 1 }, schema: thing })).resolves.toEqual({ id: '1', name: 'A' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/things?page=1')
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } })
  })

  it('refuses a path outside /api', async () => {
    await expect(api.get('https://elsewhere.test/x')).rejects.toThrow('/api/')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends a JSON body with every verb', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    for (const [verb, method] of [
      [api.post, 'POST'],
      [api.put, 'PUT'],
      [api.patch, 'PATCH'],
      [api.delete, 'DELETE'],
    ] as const) {
      await expect(verb('/api/v1/things', { body: { name: 'A' } })).resolves.toBeUndefined()
      expect(fetchMock.mock.lastCall?.[1]).toMatchObject({ method, body: '{"name":"A"}', headers: { 'Content-Type': 'application/json' } })
    }
  })

  it('turns a validation problem into field and parameter errors', async () => {
    fetchMock.mockResolvedValue(
      json(
        422,
        {
          type: 'https://bool.mv/problems/validation-error',
          title: 'Unprocessable Content',
          status: 422,
          detail: 'The request has 3 invalid fields.',
          errors: [
            { pointer: '#/owner/email', code: 'email', detail: 'must be a valid email address' },
            { pointer: '#', code: 'unknown', detail: 'has an unknown field "x"' },
            { parameter: 'pageSize', code: 'max', detail: 'must be at most 100' },
            { pointer: '#/name' },
          ],
        },
        { 'X-Request-Id': 'req-42' }
      )
    )
    const e = await failure(api.post('/api/v1/things', { body: {} }))
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({ kind: 'http', status: 422, type: 'https://bool.mv/problems/validation-error', requestId: 'req-42' })
    expect(e?.fieldErrors).toEqual({
      'owner.email': ['must be a valid email address'],
      '': ['has an unknown field "x"'],
      name: ['is invalid'],
    })
    expect(e?.fieldCodes).toEqual({ 'owner.email': ['email'], '': ['unknown'] })
    expect(e?.paramErrors).toEqual({ pageSize: ['must be at most 100'] })
    expect(e?.message).toBe('The request has 3 invalid fields.')
  })

  it('reads the reference from the problem without the header, and copes with a body that is not a problem', async () => {
    fetchMock.mockResolvedValueOnce(json(503, { title: 'Service Unavailable', instance: 'urn:uuid:abc' }))
    expect(await failure(api.get('/api/v1/x'))).toMatchObject({ status: 503, requestId: 'abc' })

    fetchMock.mockResolvedValueOnce(new Response('<html>bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }))
    expect(await failure(api.get('/api/v1/x'))).toMatchObject({ kind: 'http', title: 'Bad Gateway', fieldErrors: {} })
  })

  it('marks 403 as forbidden', async () => {
    fetchMock.mockResolvedValue(json(403, { title: 'Forbidden', status: 403 }))
    expect((await failure(api.get('/api/v1/x')))?.forbidden).toBe(true)
  })

  it('sends a 401 to sign-in before anything else', async () => {
    fetchMock.mockResolvedValue(json(401, { title: 'Unauthorized' }))
    void api.get('/api/v1/x')
    await vi.waitFor(() => expect(signIn).toHaveBeenCalledOnce())
  })

  it('reports a response that breaks its schema as a contract error naming the field', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(json(200, { id: 1, name: 'A' }))
    const e = await failure(api.get('/api/v1/x', { schema: thing }))
    expect(e).toMatchObject({ kind: 'contract' })
    expect(e?.detail).toContain('id')

    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }))
    expect(await failure(api.get('/api/v1/x', { schema: thing }))).toMatchObject({ kind: 'contract' })
  })

  it('tells network failures, cancellations, and timeouts apart', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await failure(api.get('/api/v1/x'))).toMatchObject({ kind: 'network' })

    const ctrl = new AbortController()
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      ctrl.abort()
      return Promise.reject(init.signal?.reason)
    })
    expect(await failure(api.get('/api/v1/x', { signal: ctrl.signal }))).toMatchObject({ kind: 'aborted' })

    // The timeout's own signal has fired (Node's AbortSignal.timeout ignores fake timers).
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort(new DOMException('timed out', 'TimeoutError')))
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => Promise.reject(init.signal?.reason))
    expect(await failure(api.get('/api/v1/x'))).toMatchObject({ kind: 'timeout' })
  })
})

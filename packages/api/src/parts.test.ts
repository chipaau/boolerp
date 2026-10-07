import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ApiError, pointerToPath } from './error'
import { createKeys } from './keys'
import { shouldRetry } from './query-client'
import { listOf, listSearch } from './schemas'

describe('pointerToPath', () => {
  it('turns JSON Pointers into dotted paths', () => {
    expect(pointerToPath('#/owner/email')).toBe('owner.email')
    expect(pointerToPath('#/items/0/name')).toBe('items.0.name')
    expect(pointerToPath('#')).toBe('')
    expect(pointerToPath('#/a~1b/c~0d')).toBe('a/b.c~d')
    expect(pointerToPath('/plain')).toBe('plain')
  })
})

describe('createKeys', () => {
  it('nests lists and details under the resource', () => {
    const k = createKeys('admin', 'tenants')
    expect(k.all).toEqual(['admin', 'tenants'])
    expect(k.lists()).toEqual(['admin', 'tenants', 'list'])
    expect(k.list({ page: 2 })).toEqual(['admin', 'tenants', 'list', { page: 2 }])
    expect(k.details()).toEqual(['admin', 'tenants', 'detail'])
    expect(k.detail('x')).toEqual(['admin', 'tenants', 'detail', 'x'])
  })
})

describe('shouldRetry', () => {
  const http = (status: number) => new ApiError({ kind: 'http', status, title: 't' })
  it('retries network, timeout, and 5xx twice at most; never 4xx, contract, or cancellations', () => {
    expect(shouldRetry(0, new ApiError({ kind: 'network', title: 't' }))).toBe(true)
    expect(shouldRetry(1, new ApiError({ kind: 'timeout', title: 't' }))).toBe(true)
    expect(shouldRetry(0, http(503))).toBe(true)
    expect(shouldRetry(2, http(503))).toBe(false)
    for (const s of [403, 404, 409, 422, 429]) expect(shouldRetry(0, http(s))).toBe(false)
    expect(shouldRetry(0, new ApiError({ kind: 'contract', title: 't' }))).toBe(false)
    expect(shouldRetry(0, new ApiError({ kind: 'aborted', title: 't' }))).toBe(false)
    expect(shouldRetry(0, new Error('x'))).toBe(false)
  })
})

describe('listOf', () => {
  it('parses a page and each item', () => {
    const page = listOf(z.object({ id: z.string() }))
    expect(page.parse({ items: [{ id: 'a', x: 1 }], page: 1, pageSize: 25, total: 1 })).toEqual({
      items: [{ id: 'a' }],
      page: 1,
      pageSize: 25,
      total: 1,
    })
    expect(() => page.parse({ items: [{ id: 1 }], page: 1, pageSize: 25, total: 1 })).toThrow()
  })
})

describe('listSearch', () => {
  const s = listSearch({ sorts: ['name', 'createdAt'] })
  it('fills in defaults', () => {
    expect(s.parse({})).toEqual({ page: 1, pageSize: 25 })
    expect(listSearch({ sorts: ['name'], defaultPageSize: 10 }).parse({})).toEqual({ page: 1, pageSize: 10 })
  })
  it('reads valid values', () => {
    expect(s.parse({ page: '3', pageSize: '50', q: ' cy ', sort: '-createdAt,name' })).toEqual({
      page: 3,
      pageSize: 50,
      q: 'cy',
      sort: '-createdAt,name',
    })
  })
  it('falls back on invalid values instead of failing', () => {
    expect(s.parse({ page: '0', pageSize: '500', sort: 'slug', q: 'x'.repeat(101) })).toEqual({ page: 1, pageSize: 25 })
    expect(s.parse({ q: '   ' })).toEqual({ page: 1, pageSize: 25 })
  })
})

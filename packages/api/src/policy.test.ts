import { describe, expect, it } from 'vitest'
import { ApiError } from './error'
import { decide } from './policy'

const http = (status: number, detail?: string) => new ApiError({ kind: 'http', status, title: `HTTP ${status}`, detail, requestId: 'req-1' })
const other = (kind: 'network' | 'timeout' | 'contract' | 'aborted') => new ApiError({ kind, title: kind, requestId: 'req-1' })

describe('the error policy (C185)', () => {
  describe('queries with nothing on screen: the screen shows its own state', () => {
    for (const e of [http(403), http(404), http(429), http(500), other('network'), other('timeout')]) {
      it(`${e.kind} ${e.status}: no toast`, () => {
        expect(decide(e, { operation: 'query' })).toEqual({})
      })
    }
    it('a contract break is logged', () => {
      expect(decide(other('contract'), { operation: 'query' })).toEqual({ log: true })
    })
  })

  describe('queries refreshing data on screen: a toast, keeping the data', () => {
    const cases: [ApiError, string][] = [
      [http(403), "You don't have permission to do this."],
      [http(404), 'It no longer exists.'],
      [http(429), 'Too many requests. Try again shortly.'],
      [http(503), 'The service is unavailable right now. Try again shortly.'],
      [other('network'), 'The service could not be reached. Check your connection and try again.'],
      [other('timeout'), 'The service took too long to answer. Try again shortly.'],
    ]
    for (const [e, message] of cases) {
      it(`${e.kind} ${e.status}`, () => {
        expect(decide(e, { operation: 'query', hasData: true })).toEqual({ message, reference: 'req-1', log: false })
      })
    }
  })

  describe('mutations', () => {
    it('403: a permission toast', () => {
      expect(decide(http(403), { operation: 'mutation' })).toEqual({ message: "You don't have permission to do this." })
    })
    it('404: a toast and a refetch', () => {
      expect(decide(http(404), { operation: 'mutation' })).toEqual({ message: 'It no longer exists.', refetch: true })
    })
    it('409: a toast and a refetch', () => {
      expect(decide(http(409), { operation: 'mutation' })).toEqual({
        message: 'This was changed by someone else, so it has been reloaded.',
        refetch: true,
      })
    })
    it('422 without a form: a toast with the detail', () => {
      expect(decide(http(422, 'The request has 1 invalid field.'), { operation: 'mutation' })).toEqual({
        message: 'The request has 1 invalid field.',
        reference: 'req-1',
      })
      expect(decide(http(422), { operation: 'mutation' }).message).toBe('Some values are not valid.')
    })
    it('429, 5xx, network, timeout: a toast with the reference', () => {
      expect(decide(http(429), { operation: 'mutation' })).toMatchObject({ message: 'Too many requests. Try again shortly.', reference: 'req-1' })
      expect(decide(http(500), { operation: 'mutation' })).toMatchObject({ reference: 'req-1' })
      expect(decide(other('network'), { operation: 'mutation' }).message).toMatch(/could not be reached/)
      expect(decide(other('timeout'), { operation: 'mutation' }).message).toMatch(/too long/)
    })
    it('a contract break: a toast, logged', () => {
      expect(decide(other('contract'), { operation: 'mutation' })).toEqual({
        message: 'Something went wrong reading the answer.',
        reference: 'req-1',
        log: true,
      })
    })
    it('another 4xx: its own detail', () => {
      expect(decide(http(400, 'The body is not JSON.'), { operation: 'mutation' }).message).toBe('The body is not JSON.')
    })
  })

  it('a status the caller handles itself is left to it', () => {
    expect(decide(http(422), { operation: 'mutation', handles: [422] })).toEqual({})
    expect(decide(http(409), { operation: 'mutation', handles: [409, 422] })).toEqual({})
    expect(decide(http(409), { operation: 'mutation', handles: [422] }).refetch).toBe(true)
  })

  it('a cancellation is ignored', () => {
    expect(decide(other('aborted'), { operation: 'mutation' })).toEqual({})
    expect(decide(other('aborted'), { operation: 'query', hasData: true })).toEqual({})
  })

  it('an error that is not an ApiError is logged, and toasted unless the screen shows it', () => {
    expect(decide(new Error('bug'), { operation: 'query' })).toEqual({ log: true })
    expect(decide(new Error('bug'), { operation: 'query', hasData: true })).toEqual({ message: 'Something went wrong.', log: true })
    expect(decide(new Error('bug'), { operation: 'mutation' })).toEqual({ message: 'Something went wrong.', log: true })
  })
})

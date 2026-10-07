import { afterEach, describe, expect, it, vi } from 'vitest'
import { MutationObserver } from '@tanstack/react-query'
import { ApiError } from './error'
import { createQueryClient } from './query-client'

afterEach(() => vi.restoreAllMocks())

const fail = (status: number) => () => Promise.reject(new ApiError({ kind: 'http', status, title: 't', requestId: 'req-9' }))

describe('createQueryClient (C185)', () => {
  it('leaves a failed first load to the screen, and toasts a failed refresh over shown data', async () => {
    const notify = vi.fn()
    const qc = createQueryClient({ notify })
    await qc.fetchQuery({ queryKey: ['x'], queryFn: fail(503), retry: false }).catch(() => {})
    expect(notify).not.toHaveBeenCalled()

    qc.setQueryData(['y'], { shown: true })
    await qc.fetchQuery({ queryKey: ['y'], queryFn: fail(503), retry: false, staleTime: 0 }).catch(() => {})
    expect(notify).toHaveBeenCalledWith('The service is unavailable right now. Try again shortly.', { reference: 'req-9' })
  })

  it('toasts a failed mutation and refetches its keys on a conflict', async () => {
    const notify = vi.fn()
    const qc = createQueryClient({ notify })
    const refetched = vi.spyOn(qc, 'invalidateQueries')
    const m = new MutationObserver(qc, { mutationFn: fail(409), meta: { invalidates: [['things', 'list']] } })
    await m.mutate().catch(() => {})
    expect(notify).toHaveBeenCalledWith('This was changed by someone else, so it has been reloaded.', { reference: undefined })
    expect(refetched).toHaveBeenCalledWith({ queryKey: ['things', 'list'] })
  })

  it('leaves statuses a mutation handles to it', async () => {
    const notify = vi.fn()
    const qc = createQueryClient({ notify })
    await new MutationObserver(qc, { mutationFn: fail(422), meta: { handles: [422] } }).mutate().catch(() => {})
    expect(notify).not.toHaveBeenCalled()
  })

  it("refetches a mutation's keys when it succeeds", async () => {
    const qc = createQueryClient({ notify: vi.fn() })
    const refetched = vi.spyOn(qc, 'invalidateQueries')
    await new MutationObserver(qc, { mutationFn: () => Promise.resolve('ok'), meta: { invalidates: [['things', 'list']] } }).mutate()
    expect(refetched).toHaveBeenCalledWith({ queryKey: ['things', 'list'] })
  })

  it('logs what it cannot explain', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const notify = vi.fn()
    const qc = createQueryClient({ notify })
    await new MutationObserver(qc, { mutationFn: () => Promise.reject(new Error('bug')) }).mutate().catch(() => {})
    expect(log).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Something went wrong.', { reference: undefined })
  })

  it('retries by the rules and never retries a mutation', () => {
    const qc = createQueryClient({ notify: vi.fn() })
    expect(qc.getDefaultOptions().mutations?.retry).toBe(false)
    expect(typeof qc.getDefaultOptions().queries?.retry).toBe('function')
  })
})

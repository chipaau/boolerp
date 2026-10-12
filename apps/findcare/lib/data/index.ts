// FindCare's data seam: every screen reads and acts through this module, never through
// @/lib/demo directly (lint-enforced). Today it is backed by the in-browser demo; at integration
// this module calls FindCare's API instead and lib/demo is deleted, without touching a screen.
// Its hooks are for client components; the data lives in the browser.

import { useEffect, useReducer, useSyncExternalStore } from 'react'
import { currentAccount, tick } from '@/lib/demo/engine'
import { lookup } from '@/lib/demo/records'
import { getState, getVersion, subscribe } from '@/lib/demo/store'

export * from '@/lib/demo/engine'
export { addDays, age, DOW, fmtDate, fmtDay, MON, minutesUntil, nowMin, nowMs, periodOf, startMs, toMin, today } from '@/lib/demo/time'
export type * from '@/lib/demo/types'

/** How often lapsed holds, offers and payment windows are applied, and countdowns redrawn. */
const TICK_MS = 5000

/**
 * Subscribes the calling component to the data: it re-renders when anything changes, here or in
 * another tab, and every few seconds so countdowns stay current. Returns false until the data has
 * loaded in the browser (it lives in localStorage, so the server render has none).
 */
export function useNow(): boolean {
  const version = useSyncExternalStore(subscribe, getVersion, () => -1)
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    tick()
    const id = window.setInterval(() => {
      tick()
      redraw()
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [])
  return version >= 0
}

/**
 * The whole state, for following links between records (an appointment's doctor, a branch's
 * clinic), which always exist. Browser only. For an id from the URL, use find.
 */
export const db = () => getState()

/** A record by an id that may name nothing (from the URL, or an old link): undefined if so. */
export const find = {
  doctor: (id: string | null | undefined) => lookup(getState().doctors, id),
  clinic: (id: string | null | undefined) => lookup(getState().clinics, id),
  branch: (id: string | null | undefined) => lookup(getState().branches, id),
  appointment: (id: string | null | undefined) => lookup(getState().appointments, id),
  offer: (id: string | null | undefined) => lookup(getState().offers, id),
  waitlist: (id: string | null | undefined) => lookup(getState().waitlist, id),
}

/** The signed-in account and its holder, or null. */
export function useAccount() {
  const ready = useNow()
  if (!ready) return { ready, account: null, holder: null }
  const account = currentAccount()
  return { ready, account, holder: account ? getState().patients[account.holderId] : null }
}

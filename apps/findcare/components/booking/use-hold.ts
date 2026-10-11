'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { hold, release } from '@/lib/data'
import type { SlotPick } from '@/lib/data'

type Held = { id: string; expiresAt: number }

/**
 * The time the patient picked and, once signed in, the five-minute hold that keeps it theirs while
 * they finish. Picking again or leaving releases the hold, so nobody else is kept waiting on a slot
 * that was abandoned. A hold that runs out is released and reported, but the pick stays: confirming
 * tries to hold it again.
 */
export function useHold(signedIn: boolean) {
  const [pick, setPick] = useState<SlotPick | null>(null)
  const [held, setHeld] = useState<Held | null>(null)
  const [lapsed, setLapsed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  // The hold to release on unmount, which the cleanup cannot read from state.
  const current = useRef<Held | null>(null)

  useEffect(() => {
    current.current = held
  }, [held])

  useEffect(() => () => {
    if (current.current) release(current.current.id)
  }, [])

  // Countdown, once a second while something is held.
  useEffect(() => {
    if (!held) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (held.expiresAt <= t) {
        release(held.id)
        setHeld(null)
        setLapsed(true)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [held])

  const drop = useCallback(() => {
    if (current.current) release(current.current.id)
    current.current = null
    setHeld(null)
  }, [])

  /** Picks a time and, when signed in, holds it. False when it was just taken. */
  const choose = useCallback(
    (p: SlotPick) => {
      drop()
      setLapsed(false)
      if (signedIn) {
        const h = hold(p)
        if (!h.ok) {
          setPick(null)
          return false
        }
        current.current = { id: h.id, expiresAt: h.expiresAt }
        setHeld(current.current)
        setNow(Date.now())
      }
      setPick(p)
      return true
    },
    [drop, signedIn],
  )

  /** A live hold for the pick, renewed or taken again if it lapsed; null when the time is gone. */
  const ensure = useCallback((): Held | null => {
    if (!pick) return null
    if (current.current && current.current.expiresAt > Date.now()) return current.current
    const h = hold(pick)
    if (!h.ok) return null
    current.current = { id: h.id, expiresAt: h.expiresAt }
    setHeld(current.current)
    setLapsed(false)
    return current.current
  }, [pick])

  /** Clears the pick and releases its hold. */
  const clear = useCallback(() => {
    drop()
    setPick(null)
    setLapsed(false)
  }, [drop])

  /** Forgets the pick after booking: the booking used the hold up, so there is nothing to release. */
  const consumed = useCallback(() => {
    current.current = null
    setHeld(null)
    setPick(null)
  }, [])

  const secondsLeft = held ? Math.max(0, Math.ceil((held.expiresAt - now) / 1000)) : 0
  return { pick, holdId: held?.id, secondsLeft, lapsed, choose, ensure, clear, consumed, drop }
}

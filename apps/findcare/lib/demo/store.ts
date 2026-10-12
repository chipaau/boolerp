// The demo's one state, kept in the browser (localStorage) so what a patient does — booking,
// paying, joining a waitlist — survives a reload, and shared between tabs. It stands in for the
// backend; only @/lib/data reads it. A new day starts a fresh seed, so dates stay current.
import { SEED_VERSION, seed } from './mock'
import { today } from './time'
import type { DemoState } from './types'

const KEY = 'findcare.demo'

let state: DemoState | null = null
let version = 0
const listeners = new Set<() => void>()

function notify() {
  version++
  listeners.forEach((l) => l())
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked (private mode): the demo keeps working for this page.
  }
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw) as DemoState
      if (saved.version === SEED_VERSION && saved.seededOn === today()) return saved
    }
  } catch {
    // Unreadable or blocked: seed afresh.
  }
  const fresh = seed()
  state = fresh
  persist()
  return fresh
}

/** The current state, loaded on first use. Browser only. */
export function getState(): DemoState {
  if (!state) {
    state = load()
    window.addEventListener('storage', (e) => {
      if (e.key !== KEY || !e.newValue) return
      state = JSON.parse(e.newValue) as DemoState
      notify()
    })
  }
  return state
}

/** Applies a change, saves it, and tells subscribers. */
export function commit<T>(change: (s: DemoState) => T): T {
  const result = change(getState())
  persist()
  notify()
  return result
}

export const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Changes every time the state does; React re-renders on it (useSyncExternalStore). */
export const getVersion = () => version

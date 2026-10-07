import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './src/test/server'

// Node's fetch needs absolute URLs; the app calls same-origin paths, as a browser resolves them.
const nodeFetch = globalThis.fetch
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  nodeFetch(typeof input === 'string' ? new URL(input, window.location.href) : input, init)

// Every request must have a handler: an unexpected call fails the test.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())

// jsdom has no layout observers, media queries, or scrolling.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'ResizeObserver', { value: NoopObserver, writable: true })
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})
window.scrollTo = () => {}

// The devtools panels cannot mount in jsdom; the app's own UI is what is tested.
vi.mock('@tanstack/react-devtools', () => ({ TanStackDevtools: () => null }))
vi.mock('@tanstack/react-router-devtools', () => ({ TanStackRouterDevtoolsPanel: () => null }))

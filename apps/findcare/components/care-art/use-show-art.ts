import { useSyncExternalStore } from 'react'

// Phones get no artwork: behind the content on a small screen it is clutter, and it costs battery.
// It is not mounted at all there, rather than hidden, so nothing renders out of sight.
const WIDE = '(min-width: 760px)'

const onWidth = (change: () => void) => {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener('change', change)
  return () => mq.removeEventListener('change', change)
}

/** Whether the screen is wide enough for the artwork (760px and up, where the header nav shows). */
export const useShowArt = () =>
  useSyncExternalStore(
    onWidth,
    () => window.matchMedia(WIDE).matches,
    () => false,
  )

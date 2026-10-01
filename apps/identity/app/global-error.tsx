'use client'

import { FlowUnavailable } from '@/theme/flow-unavailable'
import './globals.css'

// Shown when Kratos cannot be reached; the only way forward is to retry.
export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <FlowUnavailable />
      </body>
    </html>
  )
}

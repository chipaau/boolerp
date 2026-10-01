'use client'

import { Button } from '@workspace/ui/components/button'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'

/** Shown when Kratos cannot be reached; the only way forward is to retry. */
export function FlowUnavailable() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="flex max-w-[408px] flex-col gap-[13px]">
        <div role="alert" className="flex items-center gap-2.5 rounded-full bg-destructive-soft px-[18px] py-3">
          <HexGlyph size={11} className="text-destructive" />
          <span className="text-ui-sm text-destructive">Sign-in is unavailable right now.</span>
        </div>
        <Button variant="secondary" className="h-[52px] w-full bg-card text-ui" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    </div>
  )
}

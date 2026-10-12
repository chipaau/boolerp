'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconButton } from '@/components/ui/icon-button'

/** Copies a value; the icon turns to a check and a live region says "Copied" for screen readers. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])
  return (
    <>
      <IconButton
        label={copied ? 'Copied' : label}
        variant="glass"
        size={36}
        className={copied ? 'bg-white text-success-fg' : 'bg-white text-ink-900 hover:bg-indigo-50'}
        onClick={() => {
          // Clipboard access can be refused (permissions, an insecure origin); the number is on screen anyway.
          navigator.clipboard.writeText(value).catch(() => undefined)
          setCopied(true)
        }}
      >
        {copied ? <Check aria-hidden className="size-3.5" strokeWidth={2} /> : <Copy aria-hidden className="size-3.5" strokeWidth={1.8} />}
      </IconButton>
      <span role="status" className="sr-only">
        {copied ? 'Copied' : ''}
      </span>
    </>
  )
}

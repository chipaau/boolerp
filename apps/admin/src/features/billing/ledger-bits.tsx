import type { ReactNode } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import type { BadgeTone } from '@workspace/ui/components/badge'
import { toCsv } from '@workspace/ui/lib/csv'
import { cn } from '@workspace/ui/lib/utils'
import { formatMvr, ledgerTone } from './logic'
import type { LedgerLine, LedgerStatus } from './types'

/** The ledger's status pills; 'Credits' shows credit notes and refunds. */
export const BILLING_STATUS_FILTERS = ['All', 'Due', 'Overdue', 'Paid', 'Draft', 'Credits'] as const
export type BillingStatusFilter = (typeof BILLING_STATUS_FILTERS)[number]

const TONE: Record<ReturnType<typeof ledgerTone>, BadgeTone> = { success: 'success', warning: 'warning', neutral: 'neutral', info: 'slate' }

/** Ledger status pill (Paid, Due, Overdue, Draft, Credited, Refunded). */
export function LedgerStatusBadge({ status, size = 'sm' }: { status: LedgerStatus; size?: 'sm' | 'default' }) {
  return (
    <Badge variant={TONE[ledgerTone(status)]} size={size}>
      {status}
    </Badge>
  )
}

/** 'MVR 1,200' for invoices, '− MVR 418' for credits. */
export const signedMvr = (e: LedgerLine) => (e.kind === 'Invoice' ? '' : '− ') + formatMvr(Math.abs(e.total))

/** Overline heading inside modals. */
export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-overline text-muted-foreground', className)}>{children}</div>
}

/** Label/value rows (the design's key/value list). */
export function KeyValueRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(110px,0.7fr)_minmax(0,1.4fr)] gap-4 border-b border-divider py-2.5">
          <span className="text-caption text-muted-foreground">{r.label}</span>
          <span className="text-ui-sm font-bold text-body">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Builds the ledger CSV and hands it to the browser as a download. Returns the line count. */
export function downloadLedgerCsv(lines: LedgerLine[], tenantName: (slug: string) => string, filename = 'bool-billing-ledger.csv') {
  const head = ['Document', 'Kind', 'Tenant', 'Period', 'Issued', 'Due', 'Net (MVR)', 'GST (MVR)', 'Total (MVR)', 'Credited (MVR)', 'Status', 'Payment method', 'PO reference']
  const body = lines.map((e) => [e.no, e.kind, tenantName(e.tenantSlug), e.period, e.issued, e.due, e.net, e.tax, e.total, e.credited, e.status, e.method, e.po])
  const csv = toCsv([head, ...body])
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return lines.length
}

'use client'

import Link from 'next/link'
import { cn } from '@workspace/ui/lib/utils'
import { Page } from '@/components/shell/page'
import { SignedIn } from '@/components/shell/signed-in'
import { ButtonLink } from '@/components/ui/button'
import { Overline, PageTitle } from '@/components/ui/text'
import { ALERT_DOT, alertsFor } from '@/lib/alerts'
import type { Alert } from '@/lib/alerts'
import { accountNotifications, nowMs } from '@/lib/data'
import type { Account } from '@/lib/data'
import { routes } from '@/lib/routes'
import { SmsRow } from './sms-row'

const DAY_MS = 864e5

/**
 * "Needs you" lists only what waits on the patient, with what each card asks them to do; reminders
 * and ended offers, which the bell also shows, are covered by the texts below.
 */
const CTA: Partial<Record<Alert['kind'], string>> = { offer: 'Review', payment: 'Upload', 'session-cancelled': 'Reschedule' }

export function NotificationsScreen() {
  return (
    <SignedIn>
      {({ account }) => (
        <Page>
          <div className="mx-auto flex w-full max-w-[704px] flex-col gap-[22px]">
            <PageTitle
              overline="Updates"
              title="Notifications"
              actions={
                <Link href={routes.account()} className="cta-label whitespace-nowrap text-ink-900 no-underline hover:text-indigo-500">
                  Text settings →
                </Link>
              }
            />
            <Feed account={account} />
          </div>
        </Page>
      )}
    </SignedIn>
  )
}

function Feed({ account }: { account: Account }) {
  const alerts = alertsFor(account).filter((a) => CTA[a.kind])
  // accountNotifications is newest first, so each group keeps that order.
  const sms = accountNotifications(account.id)
  const groups = [
    { label: 'Today', items: sms.filter((n) => nowMs() - n.at < DAY_MS) },
    { label: 'Earlier', items: sms.filter((n) => nowMs() - n.at >= DAY_MS) },
  ].filter((g) => g.items.length)

  if (!alerts.length && !sms.length)
    return (
      <div className="glass flex flex-col items-center gap-2.5 rounded-[22px] p-9 text-center">
        <h2 className="text-[17px] font-semibold">Nothing yet</h2>
        <p className="max-w-[360px] text-[13px] leading-normal text-pretty text-ink-600">
          Booking confirmations, reminders, queue updates and earlier-slot offers will show up here and by text.
        </p>
        <ButtonLink href={routes.find()} className="mt-2 h-10 px-5">
          Find care
        </ButtonLink>
      </div>
    )

  return (
    <>
      {alerts.length > 0 && (
        <section className="flex flex-col gap-2">
          <Overline className="px-1">Needs you</Overline>
          {alerts.map((a) => (
            <Link
              key={a.key}
              href={a.href}
              className="flex items-center gap-3.5 rounded-[18px] bg-indigo-900 px-4 py-3.5 text-white no-underline shadow-[0_14px_34px_rgba(42,37,72,.18)] transition-colors hover:bg-indigo-950"
            >
              <span aria-hidden className={cn('size-2 shrink-0 rounded-full', ALERT_DOT[a.kind])} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{a.title}</span>
                <span className="mt-[3px] block text-[12.5px] leading-[1.45] text-indigo-300">{a.sub}</span>
              </span>
              <span className="shrink-0 text-[10.5px] font-medium tracking-[0.16em] uppercase">{CTA[a.kind]} →</span>
            </Link>
          ))}
        </section>
      )}
      {groups.map((g) => (
        <section key={g.label} className="flex flex-col gap-1.5">
          <Overline className="px-1">{g.label}</Overline>
          <div className="glass rounded-[20px] p-1.5">
            {g.items.map((n) => (
              <SmsRow key={n.id} n={n} account={account} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

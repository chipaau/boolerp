'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { Button } from '@/components/ui/button'
import { Overline } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { linkProvider, linkedAccount, signInAs, signInWithPhone } from '@/lib/data'
import { routes, safeNext } from '@/lib/routes'
import { HeroArt } from './hero-art'
import { ProviderButtons } from './provider-buttons'
import type { Provider } from './provider-buttons'

// The demo signs in to the Maldives only; at integration the country code comes from the number's country.
const CODE = '+960'
const RESEND_S = 30

/** The eyebrow says why sign-in was asked for, from where the visitor is going back to. */
/** What signing in gives, said for where the visitor was going, so a gated page explains itself. */
type Intent = { kicker: string; lead: string; strong: string; body: string }

const DEFAULT_INTENT: Intent = {
  kicker: 'Sign in or create an account',
  lead: 'Keep track of',
  strong: 'every visit.',
  body: 'You can search and book without an account. Signing in keeps your appointments, live queues, earlier-slot offers and family in one place.',
}

const INTENTS: { prefix: string; intent: Intent }[] = [
  {
    prefix: routes.myCare(),
    intent: {
      kicker: 'My Care is for signed-in patients',
      lead: 'Your care,',
      strong: 'in one place.',
      body: 'Sign in to see your next visit, today’s live queue, earlier times offered from waitlists and your family’s care, all in one place. Finding and booking a doctor never needs an account.',
    },
  },
  {
    prefix: '/appointments',
    intent: {
      kicker: 'Appointments are for signed-in patients',
      lead: 'Every booking,',
      strong: 'kept together.',
      body: 'Sign in to see your family’s visits, reschedule or cancel online, pay by transfer and keep track of your waitlists. Finding and booking a doctor never needs an account.',
    },
  },
  { prefix: routes.account(), intent: { ...DEFAULT_INTENT, kicker: 'Sign in to manage your family' } },
  { prefix: '/notifications', intent: { ...DEFAULT_INTENT, kicker: 'Sign in to see your texts' } },
  { prefix: '/doctors', intent: { ...DEFAULT_INTENT, kicker: 'Sign in to finish booking' } },
]

const intentFor = (next: string) => INTENTS.find((i) => next.startsWith(i.prefix))?.intent ?? DEFAULT_INTENT

/** Back to the booking or clinic the visitor came from; otherwise an invitation to browse. */
function backLink(next: string) {
  if (next.startsWith('/doctors')) return { href: next, label: '← Back to booking' }
  if (next.startsWith('/clinics')) return { href: next, label: '← Back to clinic' }
  return { href: routes.find(), label: 'Just browsing? Find a doctor →' }
}

const digitsOf = (s: string) => s.replace(/\D/g, '')

/**
 * Sign in: one tap with a linked provider; otherwise sign-up, which checks the provider's name and
 * verifies a mobile once (number, then code) and links the provider to that number's account.
 */
export function SignInScreen() {
  const router = useRouter()
  const nextParam = useSearchParams().get('next')
  const next = safeNext(nextParam)
  const [via, setVia] = useState<Provider | null>(null)

  const pick = (p: Provider) => {
    const linked = linkedAccount(p)
    if (!linked) return setVia(p)
    signInAs(linked.id, p)
    router.replace(next)
  }
  const back = backLink(nextParam ?? '')
  const intent = intentFor(nextParam ?? '')

  return (
    <main className="relative min-h-[calc(100svh-var(--header-h))] overflow-x-hidden [background:radial-gradient(ellipse_70%_80%_at_68%_50%,#fffcfa_0%,#fbf5f2_55%,#f4ece8_100%)] min-[760px]:h-[calc(100svh-var(--header-h))] min-[760px]:overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[24%] -left-[14%] h-[70%] w-[56%] rounded-full [background:radial-gradient(closest-side,rgba(199,188,238,.38),rgba(199,188,238,0))]"
      />
      {/* The 1440×900 drawing, centred on the right-hand space. */}
      <HeroArt className="absolute top-1/2 left-[calc((var(--page-inset)+464px)/2+50%)] h-[900px] w-[1440px] -translate-x-1/2 -translate-y-1/2 scale-[.8] opacity-[.72]" />
      {/* Centred a little above the middle on phones (the optical centre). The form starts where every page's content does (Find care's search card), and its column is
          that inset plus the form's own width, so the form is never squeezed on a wide screen. */}
      <div className="relative flex min-h-[calc(100svh-var(--header-h))] flex-col pr-[var(--page-pad)] pb-7 pl-[var(--page-inset)] min-[760px]:h-full min-[760px]:w-[calc(var(--page-inset)+464px)] min-[760px]:pr-0 min-[760px]:pb-[34px]">
        <div className="flex w-full max-w-[392px] flex-1 flex-col justify-center gap-6 pt-6 pb-[10svh] min-[760px]:gap-[30px] min-[760px]:py-6">
          {via ? (
            <SignUp key={via} via={via} onDone={() => router.replace(next)} onRestart={() => setVia(null)} />
          ) : (
            <>
              <Intro
                kicker={intent.kicker}
                title={
                  <>
                    {intent.lead}
                    <br />
                    <span className="font-semibold text-ink-900">{intent.strong}</span>
                  </>
                }
              >
                {intent.body}
              </Intro>
              <div className="flex flex-col gap-2.5">
                <ProviderButtons onProvider={pick} />
                <p className="mt-1.5 text-center text-[12px] leading-normal text-pretty text-ink-500">
                  New here? We’ll ask for your mobile once, so clinics can reach you.<span className="max-[759px]:hidden"> After that, just tap to sign in.</span>
                </p>
              </div>
            </>
          )}
        </div>
        <Link href={back.href} className="w-fit text-[12.5px] font-medium text-ink-900 no-underline hover:text-indigo-500">
          {back.label}
        </Link>
      </div>
    </main>
  )
}

/** Sign-up's one step, in a glass card: the name and mobile, then the texted code. */
function SignUp({ via, onDone, onRestart }: { via: Provider; onDone: () => void; onRestart: () => void }) {
  // The provider's profile name, which the demo makes up; the patient checks it here.
  const [name, setName] = useState(via === 'Apple' ? 'Mariyam Ali' : 'Hussain Naseem')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<'name' | 'phone' | 'code' | null>(null)
  const [resend, setResend] = useState(0)
  const noteId = useId()

  useEffect(() => {
    if (resend <= 0) return
    const id = window.setTimeout(() => setResend((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [resend])

  const sendCode = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('name')
    if (digitsOf(phone).length !== 7) return setError('phone')
    setError(null)
    setCode('')
    setResend(RESEND_S)
    setSent(true)
  }

  const verify = (e: FormEvent) => {
    e.preventDefault()
    // codes are not sent anywhere yet: any six digits are accepted
    if (!/^\d{6}$/.test(code)) return setError('code')
    signInWithPhone(`${CODE} ${digitsOf(phone)}`, name.trim())
    // The provider is linked to the number's account, new or existing, so next time one tap signs in.
    linkProvider(via)
    onDone()
  }

  return (
    <>
      <Intro
        kicker={`Create your account · ${via}`}
        title={
          <>
            One last <span className="font-semibold text-ink-900">step.</span>
          </>
        }
        nowrap
      >
        Check your name and add your mobile. Clinics use your name on bookings and your mobile for reminders, queue updates and earlier-slot offers. You only do this once. Next
        time, just tap {via}.
      </Intro>
      <div className="glass rounded-[22px] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,.95),0_20px_50px_rgba(106,92,176,.12)]">
        {sent ? (
          <form noValidate onSubmit={verify}>
            <TextField
              label={`Code sent to ${CODE} ${phone}`}
              aside={
                <button type="button" onClick={() => setSent(false)} className="cursor-pointer text-[12px] font-medium text-indigo-500 hover:text-indigo-900">
                  Change
                </button>
              }
              size="lg"
              className="gap-3"
              inputClassName="h-14 text-center text-[22px] font-semibold tracking-[.5em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="••••••"
              value={code}
              invalid={error === 'code'}
              aria-describedby={noteId}
              onChange={(e) => {
                setCode(digitsOf(e.target.value).slice(0, 6))
                setError(null)
              }}
            />
            <Button type="submit" size="lg" className="mt-3 h-12 w-full">
              Finish
            </Button>
            <Note id={noteId} error={error === 'code'}>
              {error === 'code' ? (
                'Enter the six digits from the text.'
              ) : (
                <>
                  Didn’t get it?{' '}
                  {resend > 0 ? (
                    `resend in 0:${String(resend).padStart(2, '0')}`
                  ) : (
                    <button type="button" onClick={() => setResend(RESEND_S)} className="cursor-pointer font-medium text-ink-900 hover:text-indigo-500">
                      resend now
                    </button>
                  )}
                </>
              )}
            </Note>
          </form>
        ) : (
          <form noValidate onSubmit={sendCode} className="flex flex-col gap-[18px]">
            <TextField
              label="Full name"
              aside={`From ${via}`}
              size="lg"
              autoComplete="name"
              placeholder="As on your ID card"
              value={name}
              invalid={error === 'name'}
              aria-describedby={noteId}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
            />
            <div>
              <TextField
                label="Mobile number"
                prefix={CODE}
                size="lg"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="777 1234"
                inputClassName="tracking-[.04em]"
                value={phone}
                invalid={error === 'phone'}
                aria-describedby={noteId}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/[^\d ]/g, '').slice(0, 8))
                  setError(null)
                }}
              />
              <Button type="submit" size="lg" className="mt-3 h-12 w-full">
                Send code
              </Button>
              <Note id={noteId} error={error === 'name' || error === 'phone'}>
                {error === 'name'
                  ? 'Add your name so clinics know who’s coming.'
                  : error === 'phone'
                    ? 'Enter a 7-digit mobile number.'
                    : `If this number already has an account, we’ll link ${via} to it.`}
              </Note>
            </div>
          </form>
        )}
      </div>
      <button type="button" onClick={onRestart} className="cursor-pointer self-start text-[12.5px] font-medium text-ink-600 hover:text-ink-900">
        ← Use a different account
      </button>
    </>
  )
}

function Intro({ kicker: k, title, nowrap, children }: { kicker: string; title: ReactNode; nowrap?: boolean; children: ReactNode }) {
  return (
    <div>
      <Overline size="lg">{k}</Overline>
      <h1 className={cn('mt-4 text-[clamp(30px,8vw,38px)] leading-[1.06] font-normal tracking-[-0.025em] text-ink-500', nowrap && 'whitespace-nowrap')}>{title}</h1>
      <p className="mt-3.5 text-[14px] leading-[1.55] text-pretty text-ink-600">{children}</p>
    </div>
  )
}

/** The line under a form's button: what happens next, or what to fix. */
function Note({ id, error, children }: { id: string; error: boolean; children: ReactNode }) {
  return (
    <p id={id} aria-live="polite" className={cn('mt-3 text-center text-[12px] leading-normal', error ? 'text-danger' : 'text-ink-500')}>
      {children}
    </p>
  )
}

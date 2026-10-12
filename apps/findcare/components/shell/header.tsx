'use client'

import { Bell, LogOut } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@workspace/ui/components/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { cn } from '@workspace/ui/lib/utils'
import { initialsOf } from '@/components/ui/avatar'
import { buttonClass } from '@/components/ui/button'
import { Dot } from '@/components/ui/text'
import { ALERT_DOT, alertsFor } from '@/lib/alerts'
import { signOut, useAccount } from '@/lib/data'
import { routes } from '@/lib/routes'
import { Brand } from './brand'
import { NAV, useNavHref } from './nav'

const SEEN_KEY = 'findcare.alertsSeen'

/** The sticky glass header: logo and wordmark, the three places, and the bell and account menu once signed in. */
export function Header() {
  const { account, holder } = useAccount()
  const pathname = usePathname()
  const href = useNavHref()
  // Sign in keeps the brand exactly where every page has it, and nothing else.
  const bare = pathname.startsWith('/sign-in')
  return (
    // No bar and no edge: the page shows through, and a soft blush fade under the brand and nav keeps
    // content that scrolls beneath from colliding with them.
    <header className="sticky top-0 z-40 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-[calc(var(--header-h)+24px)] before:bg-[linear-gradient(to_bottom,rgba(251,245,242,.92)_0%,rgba(251,245,242,.78)_60%,rgba(251,245,242,0)_100%)] before:backdrop-blur-[10px] before:[mask-image:linear-gradient(to_bottom,#000_55%,transparent)]">
      <div className="grid h-[var(--header-h)] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-5 px-[18px] min-[760px]:px-7">
        <Brand className="justify-self-start" />
        {!bare && (
          <>
            <nav aria-label="Main" className="hidden gap-1 min-[760px]:flex">
              {NAV.map((n) => {
                const on = n.match(pathname)
                return (
                  <Link
                    key={n.id}
                    href={href(n)}
                    aria-current={on ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center rounded-full px-4 text-[13px] font-medium no-underline transition-colors',
                      on ? 'bg-white text-ink-900 shadow-nav-active' : 'text-ink-600 hover:text-ink-900',
                    )}
                  >
                    {n.label}
                  </Link>
                )
              })}
            </nav>
            <span className="min-[760px]:hidden" />
            <div className="flex items-center gap-2.5 justify-self-end">
              {account && holder ? (
                <>
                  <AlertsBell />
                  <AccountMenu name={holder.name} phone={account.phone} />
                </>
              ) : (
                <Link href={routes.signIn(pathname)} className={buttonClass({ variant: 'primary', size: 'md' }, 'h-10 normal-case tracking-normal text-[13px] font-medium')}>
                  Sign in
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  )
}

function AlertsBell() {
  const { account } = useAccount()
  const [seen, setSeen] = useState(() => typeof window !== 'undefined' && sessionStorage.getItem(SEEN_KEY) === '1')
  if (!account) return null
  const alerts = alertsFor(account)
  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) return
        sessionStorage.setItem(SEEN_KEY, '1')
        setSeen(true)
      }}
    >
      <PopoverTrigger
        aria-label={alerts.length ? `Notifications, ${alerts.length} new` : 'Notifications'}
        className="relative flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/72 text-ink-700 shadow-[inset_0_0_0_1px_rgba(255,255,255,.9)] outline-none hover-glass focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Bell className="size-[17px]" strokeWidth={1.7} />
        {alerts.length > 0 && !seen && <Dot className="absolute top-[9px] right-2.5 shadow-[0_0_0_2px_#fff]" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(340px,calc(100vw-2rem))] gap-0 rounded-[20px] bg-white/97 p-2 text-ink-900 shadow-popover">
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
          <span className="text-[14px] font-semibold">Notifications</span>
          {alerts.length > 0 && <span className="text-[12px] text-ink-500">{alerts.length} new</span>}
        </div>
        {alerts.length === 0 && <p className="px-3 py-[18px] text-[13px] text-ink-500">You’re all caught up.</p>}
        {alerts.map((a) => (
          <Link key={a.kind + a.key} href={a.href} className="flex gap-3 rounded-[14px] px-3 py-2.5 text-ink-900 no-underline hover-ghost">
            <span aria-hidden className={cn('mt-[5px] size-2 shrink-0 rounded-full', ALERT_DOT[a.kind])} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">{a.title}</span>
              <span className="mt-0.5 block text-[12px] leading-[1.45] text-ink-600">{a.sub}</span>
            </span>
          </Link>
        ))}
        <Link
          href={routes.notifications()}
          className="mt-1 flex h-10 items-center justify-center rounded-xl text-[11px] font-medium tracking-[0.16em] text-ink-900 uppercase no-underline shadow-[inset_0_1px_0_var(--line-1)] hover-ghost"
        >
          See all notifications
        </Link>
      </PopoverContent>
    </Popover>
  )
}

function AccountMenu({ name, phone }: { name: string; phone: string }) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-indigo-900 text-[13px] font-semibold text-white shadow-avatar outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {initialsOf(name || 'Me')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-[18px] bg-white/97 p-2 text-ink-900 shadow-popover">
        <div className="px-3 pt-2.5 pb-3 shadow-[inset_0_-1px_0_var(--line-2)]">
          <div className="text-[14px] font-semibold">{name || 'Your account'}</div>
          <div className="mt-0.5 text-[12px] text-ink-500">{phone}</div>
        </div>
        <DropdownMenuItem className="mt-1.5 h-[38px] rounded-[10px] px-3 text-[13px] font-medium" onClick={() => router.push(routes.account())}>
          Profile &amp; family
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-1 my-1.5 bg-line-2" />
        <DropdownMenuItem
          className="h-[38px] gap-2.5 rounded-[10px] px-3 text-[13px] font-medium text-ink-600"
          onClick={() => {
            signOut()
            router.push(routes.find())
          }}
        >
          <LogOut className="size-[15px]" strokeWidth={1.8} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

'use client'

import { LogIn, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@workspace/ui/lib/utils'
import { useAccount } from '@/lib/data'
import { routes } from '@/lib/routes'
import { NAV, useNavHref } from './nav'

/** Under 760px the header's nav becomes this fixed bottom bar, with Profile (or Sign in) as a fourth tab. */
export function TabBar() {
  const { account } = useAccount()
  const pathname = usePathname()
  const href = useNavHref()
  if (pathname.startsWith('/sign-in')) return null
  const tabs = [
    ...NAV.map((n) => ({ id: n.id, label: n.label, icon: n.icon, fills: n.fills, href: href(n), on: n.match(pathname) })),
    account
      ? { id: 'me', label: 'Profile', icon: User, fills: true, href: routes.account(), on: pathname.startsWith('/account') }
      : { id: 'in', label: 'Sign in', icon: LogIn, fills: false, href: routes.signIn(pathname), on: false },
  ]
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 bg-glass-tabbar px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] shadow-tabbar backdrop-blur-[18px] backdrop-saturate-[1.2] min-[760px]:hidden"
    >
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.on ? 'page' : undefined}
          className={cn(
            'flex h-[58px] flex-col items-center justify-center gap-1.5 rounded-[14px] text-[11px] no-underline',
            t.on ? 'font-semibold text-ink-900' : 'font-medium text-ink-600',
          )}
        >
          <span className={cn('flex h-8 w-14 items-center justify-center rounded-full', t.on ? 'bg-indigo-900 text-white' : 'text-ink-600')}>
            {/* selected: filled where the shape allows, otherwise a heavier line */}
            <t.icon className="size-5" strokeWidth={t.on && !t.fills ? 2.4 : 1.8} fill={t.on && t.fills ? 'currentColor' : 'none'} />
          </span>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

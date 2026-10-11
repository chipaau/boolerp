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
    ...NAV.map((n) => ({ id: n.id, label: n.label, icon: n.icon, href: href(n), on: n.match(pathname) })),
    account
      ? { id: 'me', label: 'Profile', icon: User, href: routes.account(), on: pathname.startsWith('/account') }
      : { id: 'in', label: 'Sign in', icon: LogIn, href: routes.signIn(pathname), on: false },
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
          className={cn('flex h-[54px] flex-col items-center justify-center gap-1 rounded-[14px] text-[10.5px] font-medium no-underline', t.on ? 'text-ink-900' : 'text-ink-600')}
        >
          <span className={cn('flex h-[26px] w-11 items-center justify-center rounded-full', t.on ? 'bg-indigo-900 text-white' : 'text-ink-600')}>
            <t.icon className="size-[18px]" strokeWidth={1.8} />
          </span>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

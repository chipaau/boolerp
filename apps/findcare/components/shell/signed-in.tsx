'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Account, Patient } from '@/lib/data'
import { useAccount } from '@/lib/data'
import { routes } from '@/lib/routes'

/**
 * Renders its children for a signed-in patient; anyone else goes to sign-in and comes back here.
 * Nothing shows until the data has loaded in the browser.
 */
export function SignedIn({ children }: { children: (me: { account: Account; holder: Patient }) => ReactNode }) {
  const { ready, account, holder } = useAccount()
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams().toString()
  useEffect(() => {
    if (ready && !account) router.replace(routes.signIn(pathname + (search ? `?${search}` : '')))
  }, [ready, account, router, pathname, search])
  if (!ready || !account || !holder) return null
  return children({ account, holder })
}

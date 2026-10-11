import type { Metadata } from 'next'
import { AccountScreen } from '@/components/account/account-screen'

export const metadata: Metadata = { title: 'Profile & family' }

export default function AccountPage() {
  return <AccountScreen />
}

import type { Metadata } from 'next'
import { SignInScreen } from '@/components/sign-in/sign-in-screen'

export const metadata: Metadata = { title: 'Sign in' }

export default function SignInPage() {
  return <SignInScreen />
}

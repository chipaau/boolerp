import { redirect } from 'next/navigation'

// Kratos returns here after login by default; the account page is the home.
export default function Home() {
  redirect('/settings')
}

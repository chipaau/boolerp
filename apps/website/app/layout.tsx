import type { Metadata } from 'next'
import { Lato } from 'next/font/google'
import './globals.css'

// Lato, the single typeface shared with the apps (packages/ui), self-hosted and preloaded by Next with a
// size-matched fallback, so the first paint never swaps fonts and re-flows (globals.css points
// --font-sans at it)
const lato = Lato({ subsets: ['latin'], weight: ['300', '400', '700', '900'], style: ['normal', 'italic'], display: 'swap', variable: '--font-lato' })

export const metadata: Metadata = {
  title: 'Bool ERP — one system for your institution',
  description:
    'Multi-tenant ERP for Maldivian councils, ministries, health facilities, and companies. Inventory, HR, procurement, and performance — as cloud SaaS or self-hosted.',
  // the same mark as the other Bool apps (identity, workspace, admin)
  icons: { icon: '/favicon.png?v=4' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={lato.variable}>
      <body className="min-h-svh bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}

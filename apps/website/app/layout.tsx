import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bool ERP — one system for your institution',
  description:
    'Multi-tenant ERP for Maldivian councils, ministries, health facilities, and companies. Inventory, HR, procurement, and performance — as cloud SaaS or self-hosted.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-svh bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}

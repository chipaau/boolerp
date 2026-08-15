import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bool ERP',
  description: 'Multi-tenant ERP for Maldivian councils, ministries, and companies',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

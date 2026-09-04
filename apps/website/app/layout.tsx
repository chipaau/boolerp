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
      <head>
        {/* Lato is the single typeface (300 / 400 / 700 / 900) shared with the app via packages/ui */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-svh bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}

import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { Header } from '@/components/shell/header'
import { Glows } from '@/components/shell/page'
import { TabBar } from '@/components/shell/tab-bar'
import './globals.css'

// Inter 400/500/600 only, self-hosted by Next; globals.css reads it as --font-inter.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'FindCare', template: '%s · FindCare' },
  description: 'Find a doctor, service or clinic in the Maldives, book a time, and manage your family’s visits.',
}

export const viewport: Viewport = { themeColor: '#fbf5f2' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-svh antialiased">
        <Glows />
        {/* The header, tab bar and pages read the URL's search params, which need a Suspense boundary. */}
        <Suspense>
          <Header />
          {children}
          <TabBar />
        </Suspense>
      </body>
    </html>
  )
}

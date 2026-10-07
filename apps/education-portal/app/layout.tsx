import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Education portal',
  description: "A tenant's education portal.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Lato, Bool's typeface, standing in until the portal's own design chooses one;
            the weights match packages/ui so the shared primitives render as they were drawn. */}
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

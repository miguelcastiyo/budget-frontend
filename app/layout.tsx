import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AuthGate } from '@/components/auth/auth-gate'
import { AuthProvider } from '@/components/auth/auth-provider'
import { GoogleOauthProvider } from '@/components/auth/google-oauth-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Budget',
  description: 'Track your spending with a clean, minimal budgeting app',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <GoogleOauthProvider>
          <AuthProvider>
            <AuthGate>{children}</AuthGate>
          </AuthProvider>
        </GoogleOauthProvider>
        <Analytics />
      </body>
    </html>
  )
}

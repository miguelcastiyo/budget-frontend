import type { Metadata, Viewport } from 'next'
import { AuthGate } from '@/components/auth/auth-gate'
import { AuthProvider } from '@/components/auth/auth-provider'
import { GlobalErrorProvider } from '@/components/common/global-error-provider'
import { GoogleOauthProvider } from '@/components/auth/google-oauth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { FinancialAuthorityProvider } from '@/components/privacy/financial-authority-provider'
import { EncryptedVaultBoundary } from '@/components/privacy/encrypted-vault-boundary'
import './globals.css'

export const metadata: Metadata = {
  title: 'Budget',
  description: 'Track your spending with a clean, minimal budgeting app',
  applicationName: 'Budget',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      {
        url: '/brand-icon.png',
        type: 'image/png',
        sizes: '350x350',
      },
    ],
    shortcut: ['/brand-icon.png'],
    apple: [
      {
        url: '/brand-icon.png',
        type: 'image/png',
        sizes: '350x350',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Budget',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F2EA' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1113' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <GoogleOauthProvider>
            <AuthProvider>
              <GlobalErrorProvider>
                <AuthGate><FinancialAuthorityProvider><EncryptedVaultBoundary>{children}</EncryptedVaultBoundary></FinancialAuthorityProvider></AuthGate>
              </GlobalErrorProvider>
            </AuthProvider>
          </GoogleOauthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

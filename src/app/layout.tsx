import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

// Use Inter font with fallback to system fonts if Google Fonts is unreachable
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap', // Show text immediately with fallback font, swap when Inter loads
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
  preload: true,
  adjustFontFallback: true,
})

export const metadata: Metadata = {
  title: 'datafast - Premium Data Purchase Platform',
  description: 'Buy data bundles for all Ghanaian networks with ease. Fast, secure, and reliable data purchase platform.',
  keywords: 'data purchase, MTN data, Airtel data, Glo data,   data, Nigeria data bundles',
  icons: {
    icon: '/logo.jpg',
    shortcut: '/logo.jpg',
    apple: '/logo.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
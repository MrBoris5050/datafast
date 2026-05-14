import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function proxy(req) {
    const token = (req as any).nextauth?.token
    const pathname = req.nextUrl.pathname

    if (pathname.startsWith('/agent')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    if (pathname.startsWith('/wholesaler')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    if (pathname.startsWith('/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname
        if (pathname === '/' || pathname.startsWith('/auth/') || pathname.startsWith('/api/auth/')) {
          return true
        }
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/agent/:path*',
    '/wholesaler/:path*',
    '/api/auth/register'
  ]
}



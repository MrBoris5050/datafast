import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './db'
import { UserRole } from '@prisma/client'
import { verifyPassword } from './password'

// Detect if identifier is email or phone
function detectIdentifierType(identifier: string): 'email' | 'phone' {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (emailRegex.test(identifier)) {
    return 'email'
  }
  return 'phone'
}

// Warn if secret is missing in production
const nextAuthSecret = process.env.NEXTAUTH_SECRET
const nextAuthUrl = process.env.NEXTAUTH_URL

if (process.env.NODE_ENV === 'production' && !nextAuthSecret) {
  console.error('⚠️  WARNING: NEXTAUTH_SECRET is required in production mode!')
}

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email or Phone', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const identifier = credentials.email.trim()
        const identifierType = detectIdentifierType(identifier)

        // Normalize email to lowercase for case-insensitive lookup
        const normalizedIdentifier = identifierType === 'email' 
          ? identifier.toLowerCase() 
          : identifier

        // Find user by email or phone
        let user = null
        if (identifierType === 'email') {
          user = await prisma.user.findUnique({
            where: { email: normalizedIdentifier }
          })
        } else {
          user = await prisma.user.findUnique({
            where: { phone: normalizedIdentifier }
          })
        }

        if (!user || !user.isActive) {
          return null
        }

        // Verify hashed password
        if (verifyPassword(credentials.password, (user as any).password)) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.avatar
          }
        }

        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role
      }
      // Re-read role from DB when session.update() is called (e.g. after role upgrade)
      if (trigger === 'update' && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true }
        })
        if (dbUser) {
          token.role = dbUser.role
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as UserRole
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Ensure redirects stay within the same domain
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    }
  },
  pages: {
    signIn: '/auth/signin'
  },
  session: {
    strategy: 'jwt',
    // Increase maxAge for better session persistence
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
}

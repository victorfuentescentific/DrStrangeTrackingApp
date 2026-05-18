import { NextRequest, NextResponse } from 'next/server'

// Cookie name must match src/lib/auth.ts — duplicated here to avoid
// importing jose in Edge Runtime (CompressionStream not available in Edge).
// Full JWT verification happens in each API route (Node.js runtime).
const SESSION_COOKIE = 'wpm-session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — always allow
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  // Only check cookie presence here; API routes do full JWT verification.
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail, validatePassword } from '@/lib/users'
import { signToken } from '@/lib/auth'
import { createRateLimiter } from '@/lib/rate-limit'

// 5 failed attempts per IP per 10 minutes
const loginLimiter = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 })

export async function POST(request: NextRequest) {
  // Rate limit by IP before doing any DB work
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = loginLimiter.check(ip)
  if (!limit.allowed) {
    const retryAfterSec = Math.ceil((limit.resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { ok: false, error: 'Too many login attempts. Please try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    )
  }

  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, password } = body
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'email and password are required' }, { status: 400 })
  }

  const user = await findUserByEmail(email.trim().toLowerCase())
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await validatePassword(user, password)
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
  }

  // Successful login — clear the rate limit counter for this IP
  loginLimiter.reset(ip)

  const sessionUser = {
    id:           user.id,
    name:         user.name,
    email:        user.email,
    role:         user.role,
    locale:       user.locale,
    employeeType: user.employeeType ?? null,
    workflow:     user.workflow ?? null,
  }

  const token = await signToken(sessionUser)
  const TTL = 60 * 60 * 8

  const response = NextResponse.json({ ok: true, user: sessionUser })
  response.cookies.set('wpm-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL,
    sameSite: 'lax',
  })
  return response
}

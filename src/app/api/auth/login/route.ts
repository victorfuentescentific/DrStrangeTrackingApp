import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail, validatePassword } from '@/lib/users'
import { signToken, getSessionCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
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

  const user = await findUserByEmail(email)
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await validatePassword(user, password)
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
  }

  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    locale: user.locale,
  }

  const token = await signToken(sessionUser)
  const TTL = 60 * 60 * 8

  const response = NextResponse.json({ ok: true, user: sessionUser })
  response.cookies.set('wpm-session', token, {
    httpOnly: true,
    path: '/',
    maxAge: TTL,
    sameSite: 'lax',
  })
  return response
}

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { updatePassword } from '@/lib/users'
import { createRateLimiter } from '@/lib/rate-limit'

// 10 resets per admin per hour — prevents bulk-reset if an admin account is compromised
const resetLimiter = createRateLimiter({ max: 10, windowMs: 60 * 60 * 1000 })

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 })
  }

  // Rate limit by admin user ID — not IP, since admins are on trusted networks
  const limit = resetLimiter.check(session.id)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many password resets. Limit resets in 1 hour.' },
      { status: 429 },
    )
  }

  let body: { id?: string; password?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.id || !body.password) {
    return NextResponse.json({ error: 'id and password are required' }, { status: 422 })
  }
  if (body.password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 422 })
  }

  const result = await updatePassword(body.id, body.password)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to update password' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}

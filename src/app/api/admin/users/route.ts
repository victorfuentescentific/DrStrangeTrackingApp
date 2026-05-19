import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// ── GET /api/admin/users — full user list with all fields ─────────────────────

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await db
    .from('users')
    .select('id, name, email, role, employee_type, locale, workflow, is_active')
    .order('role')
    .order('employee_type')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ── PATCH /api/admin/users — update a single user (role, locale, password) ───

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { id: string; password?: string; role?: string; locale?: string | null; name?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 422 })

  const updates: Record<string, unknown> = {}

  if (body.password !== undefined) {
    if (body.password.length < 6)
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 422 })
    updates.password_hash = await bcrypt.hash(body.password, 10)
  }

  if (body.role     !== undefined) updates.role   = body.role
  if (body.locale   !== undefined) updates.locale = body.locale ?? null
  if (body.name     !== undefined) updates.name   = body.name

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 422 })

  const { error } = await db.from('users').update(updates).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

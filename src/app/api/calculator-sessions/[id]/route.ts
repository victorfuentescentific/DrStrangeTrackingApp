import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/calculator-sessions/[id]
//
// Admin-only: update label, date_from, date_to of a saved calculator session.
// All fields are optional — only provided fields are updated.
// ─────────────────────────────────────────────────────────────────────────────

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validDate(v: unknown): string | null {
  if (!v || typeof v !== 'string') return null
  if (!DATE_RE.test(v)) return null
  const d = new Date(v + 'T12:00:00')
  return isNaN(d.getTime()) ? null : v
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session)                 return NextResponse.json({ error: 'Unauthorized' },  { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Admin only' },    { status: 403 })

  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const update: Record<string, unknown> = {}

  if ('label' in body) {
    update.label = body.label ? String(body.label).slice(0, 120) : null
  }
  if ('date_from' in body) {
    update.date_from = validDate(body.date_from)
  }
  if ('date_to' in body) {
    update.date_to = validDate(body.date_to)
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 })
  }

  const { data, error } = await db
    .from('calculator_sessions')
    .update(update)
    .eq('id', id)
    .select('id, label, date_from, date_to')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...data })
}

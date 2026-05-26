import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// /api/calculator-sessions
//
// Stores and retrieves Production Calculator runs so users can review and
// reload past calculations.
//
// Required Supabase table (run once in the SQL editor):
//
//   CREATE TABLE calculator_sessions (
//     id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
//     user_id      text        NOT NULL,
//     locale       text        NOT NULL,
//     workflow     text        NOT NULL,
//     hc           integer     NOT NULL,
//     total_hours  numeric     NOT NULL,
//     iaa_days     numeric     NOT NULL,
//     p2_days      numeric     NOT NULL,
//     phi_days     numeric     NOT NULL,
//     output_full  numeric     NOT NULL,
//     output_buf   numeric     NOT NULL,
//     unit         text        NOT NULL,
//     label        text,
//     created_at   timestamptz DEFAULT now() NOT NULL
//   );
//   CREATE INDEX idx_calc_sessions_user
//     ON calculator_sessions (user_id, created_at DESC);
//
// GET  — returns the last 20 sessions for the authenticated user
// POST — saves a new session (any authenticated user)
// ─────────────────────────────────────────────────────────────────────────────

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db
    .from('calculator_sessions')
    .select('*')
    .eq('user_id', session.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    // Table may not exist yet — return empty array gracefully
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { locale, workflow, hc, total_hours, iaa_days, p2_days, phi_days,
          output_full, output_buf, unit, label } = body

  // Basic validation
  if (!locale || !workflow || !unit) {
    return NextResponse.json({ error: 'locale, workflow, and unit are required' }, { status: 422 })
  }
  if (typeof output_full !== 'number' || output_full <= 0) {
    return NextResponse.json({ error: 'output_full must be a positive number' }, { status: 422 })
  }

  const { data, error } = await db
    .from('calculator_sessions')
    .insert({
      user_id:     session.id,
      locale:      String(locale),
      workflow:    String(workflow),
      hc:          Number(hc)          || 0,
      total_hours: Number(total_hours) || 0,
      iaa_days:    Number(iaa_days)    || 0,
      p2_days:     Number(p2_days)     || 0,
      phi_days:    Number(phi_days)    || 0,
      output_full: Number(output_full),
      output_buf:  Number(output_buf)  || 0,
      unit:        String(unit),
      label:       label ? String(label).slice(0, 120) : null,
    })
    .select('id, created_at')
    .single()

  if (error) {
    if (error.code === '42P01') {
      // Table not yet created — inform the user clearly
      return NextResponse.json(
        { error: 'calculator_sessions table not found. Run the setup SQL in Supabase first.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data?.id })
}

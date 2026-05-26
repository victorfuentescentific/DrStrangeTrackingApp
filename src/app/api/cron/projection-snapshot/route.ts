import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createWeeklySnapshot } from '@/lib/projection-store'
import { toWorkset } from '@/lib/workset-mapper'

// ─── Auth helper ─────────────────────────────────────────────────────────────
// Vercel Cron sends Authorization: Bearer <CRON_SECRET>
// Manual triggers (admin) can also call this with the same secret.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

// ─── POST /api/cron/projection-snapshot ──────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  // Load all worksets from Supabase
  const { data, error } = await db
    .from('worksets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[cron/projection-snapshot] failed to load worksets:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const worksets = (data ?? []).map(row => toWorkset(row as unknown as Record<string, unknown>))

  const result = await createWeeklySnapshot(worksets, todayStr, 'cron')

  if (!result.ok) {
    console.error('[cron/projection-snapshot] snapshot failed:', result.error)
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok:      true,
    id:      result.id,
    skipped: result.skipped ?? false,
    today:   todayStr,
  })
}

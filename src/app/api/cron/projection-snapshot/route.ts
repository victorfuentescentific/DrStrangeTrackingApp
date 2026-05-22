import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createWeeklySnapshot } from '@/lib/projection-store'
import type { Workset } from '@/lib/types'

// ─── Auth helper ─────────────────────────────────────────────────────────────
// Vercel Cron sends Authorization: Bearer <CRON_SECRET>
// Manual triggers (admin) can also call this with the same secret.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

// ─── Workset loader ───────────────────────────────────────────────────────────

function toWorkset(row: Record<string, unknown>): Workset {
  return {
    id:                   row.id as string,
    worksetId:            row.workset_id as string,
    name:                 row.name as string,
    workflow:             row.workflow as Workset['workflow'],
    locale:               row.locale as string,
    team:                 row.team as Workset['team'],
    region:               row.region as Workset['region'],
    teamSize:             row.team_size as number,
    status:               row.status as Workset['status'],
    priority:             row.priority as Workset['priority'],
    riskLevel:            row.risk_level as Workset['riskLevel'],
    startDate:            row.start_date as string,
    eta:                  row.eta as string,
    revisedEta:           (row.revised_eta as string | null) ?? undefined,
    phases:               (row.phases as Workset['phases'] | null) ?? undefined,
    isBlocked:            row.is_blocked as boolean,
    blockerDescription:   (row.blocker_description as string | null) ?? undefined,
    isEscalated:          row.is_escalated as boolean,
    escalationReason:     (row.escalation_reason as string | null) ?? undefined,
    notes:                (row.notes as string) ?? '',
    completedAt:          (row.completed_at as string | null) ?? undefined,
    predecessorId:        (row.predecessor_id as string | null) ?? undefined,
    createdAt:            row.created_at as string,
    updatedAt:            row.updated_at as string,
    auditTrail:           (row.audit_trail as Workset['auditTrail']) ?? [],
  }
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

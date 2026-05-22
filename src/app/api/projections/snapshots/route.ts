import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { listSnapshots, createWeeklySnapshot } from '@/lib/projection-store'
import { db } from '@/lib/db'
import type { Workset } from '@/lib/types'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

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

// GET /api/projections/snapshots
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const snapshots = await listSnapshots(20)
    return NextResponse.json(snapshots)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/projections/snapshots  — manual trigger (admin only)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin')   return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  // Optional: allow overriding "today" for testing (date must be valid YYYY-MM-DD)
  let todayStr: string
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.today === 'string') {
      const dateRe = /^\d{4}-\d{2}-\d{2}$/
      const d = new Date(body.today + 'T12:00:00')
      if (dateRe.test(body.today) && !isNaN(d.getTime())) {
        todayStr = body.today
      } else {
        return NextResponse.json({ error: 'today must be a valid YYYY-MM-DD date' }, { status: 422 })
      }
    } else {
      todayStr = new Date().toISOString().split('T')[0]
    }
  } catch {
    todayStr = new Date().toISOString().split('T')[0]
  }

  const { data, error } = await db
    .from('worksets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const worksets = (data ?? []).map(row => toWorkset(row as unknown as Record<string, unknown>))
  const result   = await createWeeklySnapshot(worksets, todayStr, session.id)

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({
    ok:      true,
    id:      result.id,
    skipped: result.skipped ?? false,
    today:   todayStr,
  })
}

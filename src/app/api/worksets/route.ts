import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
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

// ── GET /api/worksets ─────────────────────────────────────────────────────────

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db
    .from('worksets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(toWorkset))
}

// ── POST /api/worksets ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<Workset>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.id || !body.name || !body.workflow || !body.locale)
    return NextResponse.json({ error: 'id, name, workflow, locale are required' }, { status: 422 })

  const row = {
    id:                   body.id,
    workset_id:           body.worksetId,
    name:                 body.name,
    workflow:             body.workflow,
    locale:               body.locale,
    team:                 body.team,
    region:               body.region ?? 'EU',
    team_size:            body.teamSize ?? 0,
    status:               body.status ?? 'not-started',
    priority:             body.priority ?? 'medium',
    risk_level:           body.riskLevel ?? 'low',
    start_date:           body.startDate,
    eta:                  body.eta,
    revised_eta:          body.revisedEta ?? null,
    phases:               body.phases ?? null,
    is_blocked:           body.isBlocked ?? false,
    blocker_description:  body.blockerDescription ?? null,
    is_escalated:         body.isEscalated ?? false,
    escalation_reason:    body.escalationReason ?? null,
    notes:                body.notes ?? '',
    completed_at:         body.completedAt ?? null,
    predecessor_id:       body.predecessorId ?? null,
    audit_trail:          body.auditTrail ?? [],
    created_at:           body.createdAt ?? new Date().toISOString().split('T')[0],
    updated_at:           body.updatedAt ?? new Date().toISOString().split('T')[0],
  }

  const { data, error } = await db.from('worksets').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(toWorkset(data), { status: 201 })
}

// ── PUT /api/worksets ─────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<Workset>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 422 })

  const row: Record<string, unknown> = { updated_at: new Date().toISOString().split('T')[0] }
  if (body.worksetId          !== undefined) row.workset_id          = body.worksetId
  if (body.name               !== undefined) row.name                = body.name
  if (body.workflow           !== undefined) row.workflow            = body.workflow
  if (body.locale             !== undefined) row.locale              = body.locale
  if (body.team               !== undefined) row.team                = body.team
  if (body.region             !== undefined) row.region              = body.region
  if (body.teamSize           !== undefined) row.team_size           = body.teamSize
  if (body.status             !== undefined) row.status              = body.status
  if (body.priority           !== undefined) row.priority            = body.priority
  if (body.riskLevel          !== undefined) row.risk_level          = body.riskLevel
  if (body.startDate          !== undefined) row.start_date          = body.startDate
  if (body.eta                !== undefined) row.eta                 = body.eta
  if (body.revisedEta         !== undefined) row.revised_eta         = body.revisedEta ?? null
  if (body.phases             !== undefined) row.phases              = body.phases ?? null
  if (body.isBlocked          !== undefined) row.is_blocked          = body.isBlocked
  if (body.blockerDescription !== undefined) row.blocker_description = body.blockerDescription ?? null
  if (body.isEscalated        !== undefined) row.is_escalated        = body.isEscalated
  if (body.escalationReason   !== undefined) row.escalation_reason   = body.escalationReason ?? null
  if (body.notes              !== undefined) row.notes               = body.notes
  if (body.completedAt        !== undefined) row.completed_at        = body.completedAt ?? null
  if (body.predecessorId      !== undefined) row.predecessor_id      = body.predecessorId ?? null
  if (body.auditTrail         !== undefined) row.audit_trail         = body.auditTrail

  const { data, error } = await db.from('worksets').update(row).eq('id', body.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(toWorkset(data))
}

// ── DELETE /api/worksets?id= ──────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await db.from('worksets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

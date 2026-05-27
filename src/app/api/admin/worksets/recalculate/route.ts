import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { db } from '@/lib/db'
import { calculateETA, calculateSuccessorETA } from '@/lib/eta-calculator'
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
    expirationDate:       (row.expiration_date as string | null) ?? undefined,
    completedAt:          (row.completed_at as string | null) ?? undefined,
    predecessorId:        (row.predecessor_id as string | null) ?? undefined,
    actualPhases:         (row.actual_phases as Workset['actualPhases'] | null) ?? undefined,
    createdAt:            row.created_at as string,
    updatedAt:            row.updated_at as string,
    auditTrail:           (row.audit_trail as Workset['auditTrail']) ?? [],
  }
}

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 })
  }

  // Fetch all worksets
  const { data, error } = await db
    .from('worksets')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const all = (data ?? []).map(r => toWorkset(r as unknown as Record<string, unknown>))

  // Separate standalone and back-to-back, skip completed worksets with no phases
  const standalone  = all.filter(w => !w.predecessorId)
  const backToBack  = all.filter(w =>  w.predecessorId)

  const today = new Date().toISOString().split('T')[0]

  // Map to hold freshly-calculated phases (keyed by workset id) — used when
  // computing Set 2 so we always use the just-recalculated Set 1 phases.
  const freshPhases = new Map<string, Workset['phases']>()

  let updated = 0
  let skipped = 0
  const errors: string[] = []

  // ── Pass 1: Standalone worksets ──────────────────────────────────────────────
  for (const ws of standalone) {
    if (!ws.locale || !ws.startDate) { skipped++; continue }

    const newPhases = calculateETA(ws.workflow, ws.locale, ws.teamSize, ws.startDate)
    freshPhases.set(ws.id, newPhases)

    const { error: upErr } = await db
      .from('worksets')
      .update({
        phases:     newPhases,
        eta:        newPhases.etaDate,
        updated_at: today,
        updated_by: session.email,
      })
      .eq('id', ws.id)

    if (upErr) {
      errors.push(`${ws.worksetId}: ${upErr.message}`)
    } else {
      updated++
    }
  }

  // ── Pass 2: Back-to-back worksets (Set 2) ────────────────────────────────────
  for (const ws of backToBack) {
    if (!ws.predecessorId || !ws.locale) { skipped++; continue }

    // Use freshly-calculated Set 1 phases if available, otherwise fall back to DB value
    const set1 = all.find(w => w.id === ws.predecessorId)
    const set1Phases = freshPhases.get(ws.predecessorId) ?? set1?.phases
    if (!set1Phases) { skipped++; continue }

    const newPhases = calculateSuccessorETA(set1Phases, ws.workflow, ws.locale, ws.teamSize)
    freshPhases.set(ws.id, newPhases)

    const { error: upErr } = await db
      .from('worksets')
      .update({
        phases:      newPhases,
        start_date:  newPhases.p1Start,
        eta:         newPhases.etaDate,
        updated_at:  today,
        updated_by:  session.email,
      })
      .eq('id', ws.id)

    if (upErr) {
      errors.push(`${ws.worksetId}: ${upErr.message}`)
    } else {
      updated++
    }
  }

  return NextResponse.json({
    ok:      errors.length === 0,
    updated,
    skipped,
    errors,
    message: `Recalculated ${updated} workset${updated !== 1 ? 's' : ''}${skipped ? `, skipped ${skipped}` : ''}.`,
  })
}

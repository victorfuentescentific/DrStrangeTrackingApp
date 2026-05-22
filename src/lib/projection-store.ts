import 'server-only'
import { db } from './db'
import { computeProjection, weekStart, sumWeeklyOutput, WorksetProjection } from './projections'
import type { Workset } from './types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SnapshotRow {
  id:          string
  workset_id:  string    // worksets.id (uuid)
  workset_ref: string    // human-readable workset_id field (e.g. "nl-nl_dmo_batch-a")
  name:        string
  locale:      string
  workflow:    string
  phase_label: string
  is_idle:     boolean
  days_left:   number
  min_audio:   number
  rep:         number
  wu:          number
}

export interface Snapshot {
  id:            string
  week_start:    string   // 'YYYY-MM-DD' (Monday)
  snapped_at:    string
  created_by:    string
  workset_count: number
  rows:          SnapshotRow[]
}

export interface SnapshotSummary {
  id:            string
  week_start:    string
  snapped_at:    string
  created_by:    string
  workset_count: number
  min_audio:     number
  rep:           number
  wu:            number
}

export interface Actual {
  id:         string
  week_start: string
  locale:     string
  workflow:   string
  unit:       'min audio' | 'rep' | 'WU'
  amount:     number
  entered_by: string
  entered_at: string
  notes:      string | null
}

export interface UpsertActualInput {
  week_start:  string
  locale:      string
  workflow:    string
  unit:        'min audio' | 'rep' | 'WU'
  amount:      number
  entered_by:  string
  notes?:      string
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

/** Check if a snapshot already exists for the given week. */
export async function getSnapshotForWeek(weekStartDate: string): Promise<string | null> {
  const { data } = await db
    .from('projection_snapshots')
    .select('id')
    .eq('week_start', weekStartDate)
    .maybeSingle()
  return data?.id ?? null
}

/** Create a new snapshot and its rows from current workset state. */
export async function createWeeklySnapshot(
  worksets: Workset[],
  todayStr: string,
  createdBy: string,
): Promise<{ ok: true; id: string; skipped?: boolean } | { ok: false; error: string }> {
  const monday = weekStart(new Date(todayStr + 'T12:00:00'))
  const weekStartDate = monday.toISOString().split('T')[0]

  // Idempotency: skip if already snapped this week
  const existing = await getSnapshotForWeek(weekStartDate)
  if (existing) return { ok: true, id: existing, skipped: true }

  // Only active worksets that have phase data
  const eligible = worksets.filter(
    w => w.status !== 'completed' && w.startDate && w.eta,
  )

  const projections: WorksetProjection[] = eligible.map(ws =>
    computeProjection(ws, todayStr),
  )

  // Insert snapshot header
  const { data: snap, error: snapErr } = await db
    .from('projection_snapshots')
    .insert({ week_start: weekStartDate, created_by: createdBy, workset_count: eligible.length })
    .select('id')
    .single()

  if (snapErr || !snap) {
    // Graceful TOCTOU handling: unique constraint fires when two calls race past the
    // existence check simultaneously. Treat it as "already snapped".
    if (snapErr?.code === '23505') {
      const existing2 = await getSnapshotForWeek(weekStartDate)
      if (existing2) return { ok: true, id: existing2, skipped: true }
    }
    return { ok: false, error: snapErr?.message ?? 'Failed to create snapshot' }
  }

  // Build rows
  const rows = projections.map(proj => {
    const totals = sumWeeklyOutput([proj])
    return {
      snapshot_id:  snap.id,
      workset_id:   proj.workset.id,
      workset_ref:  proj.workset.worksetId,
      name:         proj.workset.name,
      locale:       proj.workset.locale,
      workflow:     proj.workset.workflow,
      phase_label:  proj.phaseLabel,
      is_idle:      proj.isIdle,
      days_left:    proj.daysLeft,
      min_audio:    totals['min audio'],
      rep:          totals['rep'],
      wu:           totals['WU'],
    }
  })

  if (rows.length > 0) {
    const { error: rowErr } = await db
      .from('projection_snapshot_rows')
      .insert(rows)

    if (rowErr) {
      // Attempt to roll back the orphaned snapshot header.
      // If this delete also fails, we log and continue — the phantom header will
      // have no rows so it shows as 0-workset week, and a retry will create a fresh one.
      const { error: delErr } = await db.from('projection_snapshots').delete().eq('id', snap.id)
      if (delErr) console.error('[projection-store] rollback delete failed:', delErr.message)
      return { ok: false, error: `Row insert failed: ${rowErr.message}` }
    }
  }

  return { ok: true, id: snap.id }
}

/** List recent snapshots (summary only, no rows). */
export async function listSnapshots(limit = 20): Promise<SnapshotSummary[]> {
  const { data, error } = await db
    .from('projection_snapshots')
    .select('id, week_start, snapped_at, created_by, workset_count')
    .order('week_start', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`listSnapshots: ${error.message}`)

  // Annotate each summary with aggregated totals from rows
  const ids = (data ?? []).map(s => s.id as string)
  if (ids.length === 0) return []

  const { data: rowData, error: rowTotalsErr } = await db
    .from('projection_snapshot_rows')
    .select('snapshot_id, min_audio, rep, wu')
    .in('snapshot_id', ids)

  if (rowTotalsErr) throw new Error(`listSnapshots (rows): ${rowTotalsErr.message}`)

  const totalsMap: Record<string, { min_audio: number; rep: number; wu: number }> = {}
  for (const r of rowData ?? []) {
    const sid = r.snapshot_id as string
    if (!totalsMap[sid]) totalsMap[sid] = { min_audio: 0, rep: 0, wu: 0 }
    totalsMap[sid].min_audio += Number(r.min_audio ?? 0)
    totalsMap[sid].rep       += Number(r.rep ?? 0)
    totalsMap[sid].wu        += Number(r.wu ?? 0)
  }

  return (data ?? []).map(s => ({
    id:            s.id as string,
    week_start:    s.week_start as string,
    snapped_at:    s.snapped_at as string,
    created_by:    s.created_by as string,
    workset_count: s.workset_count as number,
    ...(totalsMap[s.id as string] ?? { min_audio: 0, rep: 0, wu: 0 }),
  }))
}

/** Get a single snapshot with all its rows. */
export async function getSnapshot(id: string): Promise<Snapshot | null> {
  const { data: snap, error: snapErr } = await db
    .from('projection_snapshots')
    .select('id, week_start, snapped_at, created_by, workset_count')
    .eq('id', id)
    .maybeSingle()

  if (snapErr) throw new Error(`getSnapshot: ${snapErr.message}`)
  if (!snap)   return null

  const { data: rows, error: rowErr } = await db
    .from('projection_snapshot_rows')
    .select('*')
    .eq('snapshot_id', id)
    .order('locale')

  if (rowErr) throw new Error(`getSnapshot rows: ${rowErr.message}`)

  return {
    id:            snap.id as string,
    week_start:    snap.week_start as string,
    snapped_at:    snap.snapped_at as string,
    created_by:    snap.created_by as string,
    workset_count: snap.workset_count as number,
    rows: (rows ?? []).map(r => ({
      id:          r.id as string,
      workset_id:  r.workset_id as string,
      workset_ref: r.workset_ref as string,
      name:        r.name as string,
      locale:      r.locale as string,
      workflow:    r.workflow as string,
      phase_label: r.phase_label as string,
      is_idle:     r.is_idle as boolean,
      days_left:   Number(r.days_left ?? 0),
      min_audio:   Number(r.min_audio ?? 0),
      rep:         Number(r.rep ?? 0),
      wu:          Number(r.wu ?? 0),
    })),
  }
}

// ─── Actuals ─────────────────────────────────────────────────────────────────

/** Upsert an actual production number (unique on week_start + locale + workflow + unit). */
export async function upsertActual(input: UpsertActualInput): Promise<Actual> {
  const { data, error } = await db
    .from('actuals')
    .upsert(
      {
        week_start:  input.week_start,
        locale:      input.locale,
        workflow:    input.workflow,
        unit:        input.unit,
        amount:      input.amount,
        entered_by:  input.entered_by,
        entered_at:  new Date().toISOString(),
        notes:       input.notes ?? null,
      },
      { onConflict: 'week_start,locale,workflow,unit' },
    )
    .select()
    .single()

  if (error) throw new Error(`upsertActual: ${error.message}`)
  return data as unknown as Actual
}

/** List actuals, optionally filtered by week (capped at 500 rows to prevent unbounded reads). */
export async function listActuals(weekStartDate?: string): Promise<Actual[]> {
  let q = db.from('actuals').select('*').order('week_start', { ascending: false }).limit(500)
  if (weekStartDate) q = q.eq('week_start', weekStartDate)

  const { data, error } = await q
  if (error) throw new Error(`listActuals: ${error.message}`)
  return (data ?? []) as unknown as Actual[]
}

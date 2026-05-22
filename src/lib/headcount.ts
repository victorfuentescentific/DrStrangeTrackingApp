import 'server-only'
import { db } from './db'
import seedData from './headcount-data.json'
import { HeadcountRecord, HeadcountAnalytics, normalizeStatus } from './headcount-types'

// accounts_credentials is the single source of truth for all user data.
// The JSON file is kept only as a dev-time fallback if Supabase is unreachable.

const SEED: HeadcountRecord[] = seedData as HeadcountRecord[]

// camelCase ↔ snake_case mapping (the only place this lives).
// password_hash and last_updated_by are intentionally excluded — they must never
// be sent to the client. last_updated_by is written by updateHeadcount() directly.
const COL_MAP: Array<{ js: keyof HeadcountRecord; db: string }> = [
  { js: 'id',                db: 'id' },
  { js: 'name',              db: 'name' },
  { js: 'locale',            db: 'locale' },
  { js: 'role',              db: 'role' },
  { js: 'position',          db: 'position' },
  { js: 'workflow',          db: 'workflow' },
  { js: 'resourceType',      db: 'resource_type' },
  { js: 'onboardingStatus',  db: 'onboarding_status' },
  { js: 'idCheckDate',       db: 'id_check_date' },
  { js: 'startDate',         db: 'start_date' },
  { js: 'personalEmail',     db: 'personal_email' },
  { js: 'centificEmail',     db: 'centific_email' },
  { js: 'shippingAddress',   db: 'shipping_address' },
  { js: 'phoneNumber',       db: 'phone_number' },
  { js: 'phoneVersion',      db: 'phone_version' },
  { js: 'laptopType',        db: 'laptop_type' },
  { js: 'oneFormaId',        db: 'one_forma_id' },
  { js: 'empId',             db: 'emp_id' },
  { js: 'vMicrosoftEmail',   db: 'v_microsoft_email' },
  { js: 'msId',              db: 'ms_id' },
  { js: 'status',            db: 'status' },
  { js: 'inactiveDate',      db: 'inactive_date' },
  { js: 'remarks',           db: 'remarks' },
]

// Derived from COL_MAP — single source of truth for which columns to fetch.
// Excludes password_hash and last_updated_by (server-only fields).
const SELECT_COLS = COL_MAP.map(e => e.db).join(', ')

function fromDb(row: Record<string, unknown>): HeadcountRecord {
  const rec = {} as Record<keyof HeadcountRecord, unknown>
  for (const { js, db } of COL_MAP) {
    rec[js] = (row[db] as string | null) ?? null
  }
  return rec as HeadcountRecord
}

function toDb(rec: Partial<HeadcountRecord>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const { js, db } of COL_MAP) {
    if (js in rec) row[db] = rec[js] ?? null
  }
  return row
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getAllHeadcount(): Promise<HeadcountRecord[]> {
  const { data, error } = await db
    .from('Account credentials')
    .select(SELECT_COLS)
    .order('name')
  if (error) {
    console.error('getAllHeadcount Supabase error:', error.message)
    throw new Error(`Failed to load headcount data: ${error.message}`)
  }
  return (data ?? []).map(row => fromDb(row as unknown as Record<string, unknown>))
}

export interface UpdateResult {
  ok: boolean
  record?: HeadcountRecord
  error?: string
}

export async function updateHeadcount(
  id: string,
  patch: Partial<Omit<HeadcountRecord, 'id'>>,
  updatedBy: string,
): Promise<UpdateResult> {
  const row = { ...toDb(patch), last_updated_by: updatedBy }

  const { data, error } = await db
    .from('Account credentials')
    .update(row)
    .eq('id', id)
    .select(SELECT_COLS)
    .single()

  if (error) {
    console.error('updateHeadcount Supabase error:', { message: error.message, details: error.details, hint: error.hint, code: error.code })
    return { ok: false, error: `Supabase: ${error.message}${error.hint ? ' — ' + error.hint : ''}` }
  }
  if (!data) {
    return { ok: false, error: `No record with id "${id}" found in accounts_credentials.` }
  }
  return { ok: true, record: fromDb(data as unknown as Record<string, unknown>) }
}

// ─── Filtering / analytics ──────────────────────────────────────────────────

export interface HeadcountFilters {
  locale?: string[]
  workflow?: string[]
  resourceType?: string[]
  status?: string[]
  search?: string
}

function matchesMulti(value: string | null, allowed?: string[]): boolean {
  if (!allowed || allowed.length === 0) return true
  return value !== null && allowed.includes(value)
}

export function filterHeadcount(
  records: HeadcountRecord[],
  f: HeadcountFilters,
): HeadcountRecord[] {
  return records.filter(r => {
    if (!matchesMulti(r.locale,       f.locale))       return false
    if (!matchesMulti(r.workflow,     f.workflow))     return false
    if (!matchesMulti(r.resourceType, f.resourceType)) return false
    if (!matchesMulti(r.status,       f.status))       return false
    if (f.search) {
      const q = f.search.toLowerCase()
      const hay = [r.name, r.centificEmail, r.personalEmail, r.empId, r.msId, r.oneFormaId]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function computeAnalytics(records: HeadcountRecord[]): HeadcountAnalytics {
  const bucket = (): { active: number; inactive: number; offboarded: number; total: number } =>
    ({ active: 0, inactive: 0, offboarded: 0, total: 0 })

  const result: HeadcountAnalytics = {
    total: records.length,
    active: 0,
    inactive: 0,
    offboarded: 0,
    byLocale: {},
    byWorkflow: {},
    byResourceType: {},
    byRole: {},
    byPosition: {},
  }

  for (const r of records) {
    const st = normalizeStatus(r.status)
    if (st === 'Active') result.active++
    else if (st === 'Inactive') result.inactive++
    else if (st === 'Offboarded') result.offboarded++

    const inc = (map: Record<string, ReturnType<typeof bucket>>, key: string | null) => {
      const k = key && key.trim() ? key : '—'
      if (!map[k]) map[k] = bucket()
      map[k].total++
      if (st === 'Active') map[k].active++
      else if (st === 'Inactive') map[k].inactive++
      else if (st === 'Offboarded') map[k].offboarded++
    }

    inc(result.byLocale, r.locale)
    inc(result.byWorkflow, r.workflow)
    inc(result.byResourceType, r.resourceType)
    inc(result.byRole, r.role)
    inc(result.byPosition, r.position)
  }

  return result
}

export function distinctValues(records: HeadcountRecord[], key: keyof HeadcountRecord): string[] {
  const set = new Set<string>()
  for (const r of records) {
    const v = r[key]
    if (typeof v === 'string' && v.trim()) set.add(v.trim())
  }
  return Array.from(set).sort()
}

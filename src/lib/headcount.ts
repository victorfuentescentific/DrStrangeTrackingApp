import 'server-only'
import data from './headcount-data.json'
import { HeadcountRecord, HeadcountAnalytics, normalizeStatus } from './headcount-types'

// JSON-loaded source of truth for the Phase-1 HC overview.
// When migrating to Supabase, swap the import for a db query and keep the same signatures.

export function getAllHeadcount(): HeadcountRecord[] {
  return data as HeadcountRecord[]
}

export interface HeadcountFilters {
  locale?: string
  workflow?: string
  resourceType?: string
  status?: string
  search?: string
}

export function filterHeadcount(
  records: HeadcountRecord[],
  f: HeadcountFilters,
): HeadcountRecord[] {
  return records.filter(r => {
    if (f.locale       && r.locale       !== f.locale)       return false
    if (f.workflow     && r.workflow     !== f.workflow)     return false
    if (f.resourceType && r.resourceType !== f.resourceType) return false
    if (f.status       && r.status       !== f.status)       return false
    if (f.search) {
      const q = f.search.toLowerCase()
      const hay = [r.name, r.centificEmail, r.personalEmail, r.empId, r.msId, r.oneFormaId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
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

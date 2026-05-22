import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import {
  getAllHeadcount,
  filterHeadcount,
  computeAnalytics,
  distinctValues,
  updateHeadcount,
  HeadcountFilters,
} from '@/lib/headcount'
import { HeadcountRecord } from '@/lib/headcount-types'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// Parse repeated query params (?locale=a&locale=b) OR comma-joined (?locale=a,b)
function multi(sp: URLSearchParams, key: string): string[] | undefined {
  const all = sp.getAll(key)
  if (all.length === 0) return undefined
  const flat = all.flatMap(v => v.split(',')).map(s => s.trim()).filter(Boolean)
  return flat.length ? flat : undefined
}

// ─── GET /api/headcount ─────────────────────────────────────────────────────
// Filters: ?locale=de_DE&locale=nl_NL&workflow=Scriber&resourceType=FTE&status=Active&search=x&analytics=1
// Headcount data contains PII; restricted to admin + lead (PM) roles only.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'lead') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const filters: HeadcountFilters = {
    locale:       multi(sp, 'locale'),
    workflow:     multi(sp, 'workflow'),
    resourceType: multi(sp, 'resourceType'),
    status:       multi(sp, 'status'),
    search:       sp.get('search') || undefined,
  }

  let all: Awaited<ReturnType<typeof getAllHeadcount>>
  try {
    all = await getAllHeadcount()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 503 })
  }
  const filtered = filterHeadcount(all, filters)

  const payload: Record<string, unknown> = {
    records: filtered,
    facets: {
      locales:       distinctValues(all, 'locale'),
      workflows:     distinctValues(all, 'workflow'),
      resourceTypes: distinctValues(all, 'resourceType'),
      statuses:      distinctValues(all, 'status'),
    },
  }
  if (sp.get('analytics') === '1') {
    payload.analytics = computeAnalytics(filtered)
  }
  return NextResponse.json(payload)
}

// ─── PATCH /api/headcount ───────────────────────────────────────────────────
// Body: { id: string, patch: Partial<HeadcountRecord> }
// Admin only — edits are persisted to Supabase with updated_at + updated_by.
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin role required to edit headcount.' }, { status: 403 })
  }

  let body: { id?: string; patch?: Partial<HeadcountRecord> }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.id || !body.patch) {
    return NextResponse.json({ error: 'id and patch are required' }, { status: 422 })
  }

  // Disallow id mutation explicitly
  if ('id' in body.patch) delete (body.patch as Record<string, unknown>).id

  // Validate status if provided
  const validStatuses = ['Active', 'Inactive', 'Offboarded']
  if (body.patch.status && !validStatuses.includes(body.patch.status)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 422 })
  }

  // Normalize centific email if provided
  if (body.patch.centificEmail) {
    body.patch.centificEmail = body.patch.centificEmail.trim().toLowerCase()
  }

  const result = await updateHeadcount(body.id, body.patch, session.email)
  if (!result.ok) {
    const isNotFound = result.error?.includes('No record with id')
    return NextResponse.json(
      { error: result.error ?? 'Update failed' },
      { status: isNotFound ? 404 : 500 },
    )
  }
  return NextResponse.json({ ok: true, record: result.record })
}

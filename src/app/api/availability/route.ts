import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import {
  getAvailabilityByUser,
  getAvailabilityRange,
  upsertAvailability,
  deleteAvailability,
  FTE_ONLY_STATUSES,
  type AvailabilityStatus,
} from '@/lib/availability'

const VALID_STATUSES: AvailabilityStatus[] = [
  'AVAILABLE','PTO','BH','NO','SL','WA','UL','DH','PATERNITY','OTHER',
]
const VALID_HOURS = [0, 2, 4, 6, 8, 10, 12]

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// ── GET /api/availability ─────────────────────────────────────────────────────
// Query: userId?, from?, to?, locale?, workflow?

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const qUserId   = searchParams.get('userId')
  const qFrom     = searchParams.get('from') ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const qTo       = searchParams.get('to')   ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)
  const qLocale   = searchParams.get('locale') ?? undefined
  const qWorkflow = searchParams.get('workflow') ?? undefined

  // Freelancers can only see their own data
  const effectiveUserId =
    session.role === 'freelancer' ? session.id : (qUserId ?? undefined)

  if (effectiveUserId) {
    const data = await getAvailabilityByUser(effectiveUserId, qFrom, qTo)
    return NextResponse.json(data)
  }

  // Admin/PM: range query with optional filters
  const data = await getAvailabilityRange(qFrom, qTo, {
    locale: qLocale,
    workflow: qWorkflow,
  })
  return NextResponse.json(data)
}

// ── POST /api/availability ────────────────────────────────────────────────────
// Upsert one submission (create or update for user+date)

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Freelancers can only submit for themselves
  const userId = session.role === 'freelancer' ? session.id : (body.userId as string ?? session.id)
  const status = body.status as AvailabilityStatus
  const errors: string[] = []

  // ── Validation ──────────────────────────────────────────────────────────────

  const date = body.date as string
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    errors.push('date must be YYYY-MM-DD')

  if (!VALID_STATUSES.includes(status))
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`)

  // Block freelancers from FTE-only statuses
  if (session.role === 'freelancer' && FTE_ONLY_STATUSES.includes(status))
    errors.push(`status ${status} is not available for freelancers`)

  const availabilityHours = body.availabilityHours as number | null ?? null
  if (availabilityHours !== null && !VALID_HOURS.includes(availabilityHours))
    errors.push(`availabilityHours must be one of: ${VALID_HOURS.join(', ')}`)

  // Hours required when status = AVAILABLE or WA
  if ((status === 'AVAILABLE' || status === 'WA') && availabilityHours === null)
    errors.push('availabilityHours is required when status is AVAILABLE or WA')

  const estimatedStartCet = body.estimatedStartCet as string | null ?? null
  // Start time required when hours > 0
  if (availabilityHours && availabilityHours > 0 && !estimatedStartCet)
    errors.push('estimatedStartCet is required when availabilityHours > 0')

  // Weekend guard
  const dow = new Date(date + 'T12:00:00Z').getUTCDay()
  if (dow === 0 || dow === 6)
    errors.push('Cannot submit availability for weekends')

  if (errors.length > 0)
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 422 })

  const created = await upsertAvailability({
    userId,
    date,
    status,
    availabilityHours,
    estimatedStartCet,
    locale:    body.locale   as string | null ?? null,
    workflow:  body.workflow  as string | null ?? null,
    notes:     body.notes    as string ?? '',
    submittedBy: session.id,
  })

  return NextResponse.json(created, { status: 201 })
}

// ── DELETE /api/availability?id= ──────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'freelancer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await deleteAvailability(id)
  return NextResponse.json({ ok: true })
}

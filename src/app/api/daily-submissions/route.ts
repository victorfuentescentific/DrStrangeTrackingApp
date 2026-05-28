import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  readDailySubmissions,
  readDailySubmissionsByRange,
  addDailySubmission,
  updateDailySubmission,
  type DailySubmission,
} from '@/lib/daily-submissions'

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// ─── GET /api/daily-submissions ──────────────────────────────────────────────
// Query params: from?, to?
// Freelancers scoped to their own records. Admins see all.

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  let submissions: DailySubmission[]

  if (from && to) {
    submissions = await readDailySubmissionsByRange(from, to)
  } else {
    submissions = await readDailySubmissions()
  }

  // Freelancers can only see their own records
  if (session.role === 'freelancer') {
    submissions = submissions.filter(s => s.userId === session.id)
  }

  return NextResponse.json(submissions)
}

// ─── POST /api/daily-submissions ─────────────────────────────────────────────
// Freelancers' userId/userName forced from session.
// Admins can pass userId/userName in body.

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  // Resolve identity
  const userId   = session.role === 'freelancer' ? session.id   : (body.userId   as string ?? session.id)
  const userName = session.role === 'freelancer' ? session.name : (body.userName as string ?? session.name)
  const userLocale: string | null =
    session.role === 'freelancer'
      ? session.locale ?? null
      : (typeof body.userLocale === 'string' ? body.userLocale : session.locale ?? null)

  // Required fields
  const errors: string[] = []

  const date   = body.date   as string | undefined
  const locale = body.locale as string | undefined
  const productionHours        = body.productionHours        as number | undefined
  const hasNonProduction       = body.hasNonProduction       as boolean | undefined
  const totalNonProductionHours = body.totalNonProductionHours as number | undefined
  const npHours2pass    = body.npHours2pass    as number | undefined
  const npHoursPhi      = body.npHoursPhi      as number | undefined
  const npHoursIAA      = body.npHoursIAA      as number | undefined
  const npHoursTraining = body.npHoursTraining as number | undefined
  const npHoursReview   = body.npHoursReview   as number | undefined
  const npHoursWaiting  = body.npHoursWaiting  as number | undefined
  const npHoursMeetings = body.npHoursMeetings as number | undefined
  const npHoursIT       = body.npHoursIT       as number | undefined
  const npHoursOther    = body.npHoursOther    as number | undefined
  const otherWorkingRemarks = typeof body.otherWorkingRemarks === 'string' ? body.otherWorkingRemarks : ''
  const totalWorkingHours = body.totalWorkingHours as number | undefined
  const remarks = body.remarks as string | undefined

  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('date must be a valid YYYY-MM-DD string')
  } else {
    const today = new Date().toISOString().slice(0, 10)
    if (date > today) errors.push('date cannot be in the future')
  }

  if (!locale || typeof locale !== 'string') errors.push('locale is required')
  if (typeof productionHours !== 'number' || productionHours < 0)
    errors.push('productionHours must be a non-negative number')
  if (typeof hasNonProduction !== 'boolean')
    errors.push('hasNonProduction must be a boolean')
  if (typeof totalNonProductionHours !== 'number' || totalNonProductionHours < 0)
    errors.push('totalNonProductionHours must be a non-negative number')
  if (typeof npHours2pass    !== 'number') errors.push('npHours2pass is required')
  if (typeof npHoursPhi      !== 'number') errors.push('npHoursPhi is required')
  if (typeof npHoursTraining !== 'number') errors.push('npHoursTraining is required')
  if (typeof npHoursReview   !== 'number') errors.push('npHoursReview is required')
  if (typeof npHoursOther    !== 'number') errors.push('npHoursOther is required')
  // New fields are optional (default 0) to remain backward compatible
  if (typeof totalWorkingHours !== 'number' || totalWorkingHours < 0)
    errors.push('totalWorkingHours must be a non-negative number')
  if (!remarks || typeof remarks !== 'string' || remarks.trim() === '')
    errors.push('remarks is required')

  const miscCost: number | null =
    typeof body.miscCost === 'number' ? body.miscCost : null
  if (miscCost !== null && miscCost < 0) errors.push('miscCost must be >= 0')

  const invoiceUrls: string[] = Array.isArray(body.invoiceUrls)
    ? (body.invoiceUrls as string[])
    : []

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 422 })
  }

  const created = await addDailySubmission({
    userId,
    userName,
    userLocale,
    date:                  date!,
    locale:                locale!,
    productionHours:       productionHours!,
    hasNonProduction:      hasNonProduction!,
    totalNonProductionHours: totalNonProductionHours!,
    npHours2pass:          npHours2pass!,
    npHoursPhi:            npHoursPhi!,
    npHoursIAA:            typeof npHoursIAA      === 'number' ? npHoursIAA      : 0,
    npHoursTraining:       npHoursTraining!,
    npHoursReview:         npHoursReview!,
    npHoursWaiting:        typeof npHoursWaiting  === 'number' ? npHoursWaiting  : 0,
    npHoursMeetings:       typeof npHoursMeetings === 'number' ? npHoursMeetings : 0,
    npHoursIT:             typeof npHoursIT       === 'number' ? npHoursIT       : 0,
    npHoursOther:          npHoursOther!,
    otherWorkingRemarks,
    totalWorkingHours:     totalWorkingHours!,
    remarks:               remarks!.trim(),
    miscCost,
    invoiceUrls,
  })

  return NextResponse.json(created, { status: 201 })
}

// ─── PATCH /api/daily-submissions?id= ────────────────────────────────────────
// Admin only.

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const updates: Partial<Omit<DailySubmission, 'id' | 'submittedAt' | 'updatedAt'>> = {}

  if (body.date                    !== undefined) updates.date                    = body.date as string
  if (body.locale                  !== undefined) updates.locale                  = body.locale as string
  if (body.productionHours         !== undefined) updates.productionHours         = body.productionHours as number
  if (body.hasNonProduction        !== undefined) updates.hasNonProduction        = body.hasNonProduction as boolean
  if (body.totalNonProductionHours !== undefined) updates.totalNonProductionHours = body.totalNonProductionHours as number
  if (body.npHours2pass            !== undefined) updates.npHours2pass            = body.npHours2pass as number
  if (body.npHoursPhi              !== undefined) updates.npHoursPhi              = body.npHoursPhi as number
  if (body.npHoursIAA              !== undefined) updates.npHoursIAA              = body.npHoursIAA as number
  if (body.npHoursTraining         !== undefined) updates.npHoursTraining         = body.npHoursTraining as number
  if (body.npHoursReview           !== undefined) updates.npHoursReview           = body.npHoursReview as number
  if (body.npHoursWaiting          !== undefined) updates.npHoursWaiting          = body.npHoursWaiting as number
  if (body.npHoursMeetings         !== undefined) updates.npHoursMeetings         = body.npHoursMeetings as number
  if (body.npHoursIT               !== undefined) updates.npHoursIT               = body.npHoursIT as number
  if (body.npHoursOther            !== undefined) updates.npHoursOther            = body.npHoursOther as number
  if (body.otherWorkingRemarks     !== undefined) updates.otherWorkingRemarks     = body.otherWorkingRemarks as string
  if (body.totalWorkingHours       !== undefined) updates.totalWorkingHours       = body.totalWorkingHours as number
  if (body.remarks                 !== undefined) updates.remarks                 = body.remarks as string
  if (body.miscCost                !== undefined) updates.miscCost                = body.miscCost as number | null
  if (body.invoiceUrls             !== undefined) updates.invoiceUrls             = body.invoiceUrls as string[]

  const updated = await updateDailySubmission(id, updates)
  return NextResponse.json(updated)
}

// ─── DELETE /api/daily-submissions?id= ───────────────────────────────────────
// Admin only.

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await db.from('daily_submissions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

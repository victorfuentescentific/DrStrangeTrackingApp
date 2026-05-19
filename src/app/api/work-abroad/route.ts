import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import {
  getWorkAbroadByUser,
  getWorkAbroadRange,
  createWorkAbroad,
  updateWorkAbroad,
  deleteWorkAbroad,
} from '@/lib/work-abroad'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// ── GET /api/work-abroad ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const qUserId = searchParams.get('userId')
  const qFrom   = searchParams.get('from')
  const qTo     = searchParams.get('to')

  // Freelancers see only their own
  if (session.role === 'freelancer') {
    const data = await getWorkAbroadByUser(session.id)
    return NextResponse.json(data)
  }

  // Admin/PM with date range
  if (qFrom && qTo) {
    const data = await getWorkAbroadRange(qFrom, qTo)
    return NextResponse.json(data)
  }

  if (qUserId) {
    const data = await getWorkAbroadByUser(qUserId)
    return NextResponse.json(data)
  }

  // Default: current month
  const now   = new Date()
  const from  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to    = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const data  = await getWorkAbroadRange(from, to)
  return NextResponse.json(data)
}

// ── POST /api/work-abroad ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const userId            = session.role === 'freelancer' ? session.id : (body.userId as string ?? session.id)
  const originCountry     = body.originCountry as string
  const destinationCountry = body.destinationCountry as string
  const dateFrom          = body.dateFrom as string
  const dateTo            = body.dateTo as string
  const errors: string[]  = []

  if (!originCountry)      errors.push('originCountry is required')
  if (!destinationCountry) errors.push('destinationCountry is required')
  if (!dateFrom || !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) errors.push('dateFrom must be YYYY-MM-DD')
  if (!dateTo   || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo))   errors.push('dateTo must be YYYY-MM-DD')
  if (dateFrom && dateTo && dateTo < dateFrom) errors.push('dateTo must be on or after dateFrom')

  if (errors.length > 0)
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 422 })

  const created = await createWorkAbroad({
    userId,
    originCountry,
    destinationCountry,
    dateFrom,
    dateTo,
    notes:       body.notes as string ?? '',
    submittedBy: session.id,
  })

  return NextResponse.json(created, { status: 201 })
}

// ── PUT /api/work-abroad?id= ──────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const updated = await updateWorkAbroad(id, {
    originCountry:      body.originCountry as string,
    destinationCountry: body.destinationCountry as string,
    dateFrom:           body.dateFrom as string,
    dateTo:             body.dateTo as string,
    notes:              body.notes as string,
  })

  return NextResponse.json(updated)
}

// ── DELETE /api/work-abroad?id= ───────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await deleteWorkAbroad(id)
  return NextResponse.json({ ok: true })
}

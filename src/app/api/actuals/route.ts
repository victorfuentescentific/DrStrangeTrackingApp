import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { upsertActual, listActuals } from '@/lib/projection-store'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// GET /api/actuals?week=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const week = req.nextUrl.searchParams.get('week') ?? undefined

  try {
    const actuals = await listActuals(week)
    return NextResponse.json(actuals)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/actuals — admin or lead only
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.role !== 'admin' && session.role !== 'lead') {
    return NextResponse.json({ error: 'Admin or lead role required' }, { status: 403 })
  }

  let body: {
    week_start?: string
    locale?:     string
    workflow?:   string
    unit?:       string
    amount?:     unknown
    notes?:      string
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { week_start, locale, workflow, unit, amount, notes } = body

  if (!week_start || !locale || !workflow || !unit || amount === undefined) {
    return NextResponse.json(
      { error: 'week_start, locale, workflow, unit, amount are required' },
      { status: 422 },
    )
  }

  // Validate date format and snap to Monday
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(week_start)) {
    return NextResponse.json({ error: 'week_start must be YYYY-MM-DD' }, { status: 422 })
  }
  // Normalize to ISO Monday of the given week to prevent key drift
  const parsedDate = new Date(week_start + 'T12:00:00')
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'week_start is not a valid date' }, { status: 422 })
  }
  const dow = parsedDate.getDay()
  const diffToMon = dow === 0 ? -6 : 1 - dow
  parsedDate.setDate(parsedDate.getDate() + diffToMon)
  const normalizedWeek = parsedDate.toISOString().split('T')[0]

  // Allowlist locale and workflow to prevent garbage data
  const VALID_LOCALES   = ['en_GB', 'de_DE', 'nl_NL', 'fr_FR', 'da_DK', 'nb_NO', 'fi_FI', 'sv_SE']
  const VALID_WORKFLOWS = ['DAX', 'DMO', 'Scribing']
  if (!VALID_LOCALES.includes(locale as string)) {
    return NextResponse.json({ error: `locale must be one of: ${VALID_LOCALES.join(', ')}` }, { status: 422 })
  }
  if (!VALID_WORKFLOWS.includes(workflow as string)) {
    return NextResponse.json({ error: `workflow must be one of: ${VALID_WORKFLOWS.join(', ')}` }, { status: 422 })
  }

  if (!['min audio', 'rep', 'WU'].includes(unit as string)) {
    return NextResponse.json({ error: `unit must be one of: min audio, rep, WU` }, { status: 422 })
  }

  const numAmount = Number(amount)
  if (isNaN(numAmount) || numAmount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 422 })
  }
  if (numAmount > 1_000_000) {
    return NextResponse.json({ error: 'amount exceeds maximum allowed value (1,000,000)' }, { status: 422 })
  }

  try {
    const actual = await upsertActual({
      week_start:  normalizedWeek,
      locale:      locale as string,
      workflow:    workflow as string,
      unit:        unit as 'min audio' | 'rep' | 'WU',
      amount:      numAmount,
      entered_by:  session.id,
      notes,
    })
    return NextResponse.json(actual)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

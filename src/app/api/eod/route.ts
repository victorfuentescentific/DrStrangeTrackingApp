import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import {
  readEodSubmissions,
  readEodByDate,
  readEodByUserAndDate,
  readEodByLocaleAndDate,
  addEodSubmission,
  updateEodSubmission,
  deleteEodSubmission,
} from '@/lib/eod-submissions'

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// ─── Madrid time helpers ──────────────────────────────────────────────────────

function getMadridHHMM(): { h: number; m: number } {
  const str = new Date().toLocaleString('en-US', {
    timeZone: 'Europe/Madrid',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const [h, m] = str.split(':').map(Number)
  return { h, m }
}

/** Returns true if the current Madrid time is past 17:30 (edit lock) */
function isPastEditLock(): boolean {
  const { h, m } = getMadridHHMM()
  return h > 17 || (h === 17 && m >= 30)
}

// ─── GET /api/eod ──────────────────────────────────────────────────────────────
// Query params: date? (YYYY-MM-DD), mine? (boolean)
// - Viewers and non-admins get only their own record.
// - Admins/PM see all for the date.
// - Leads see their locale only.

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const mine = searchParams.get('mine') === 'true'

  // Own record lookup (used by form page to check existing submission)
  if (mine) {
    const record = await readEodByUserAndDate(session.id, date)
    return NextResponse.json(record)
  }

  const role = session.role

  if (role === 'admin' || role === 'pm') {
    const records = await readEodByDate(date)
    return NextResponse.json(records)
  }

  if (role === 'lead' && session.locale) {
    const records = await readEodByLocaleAndDate(session.locale, date)
    return NextResponse.json(records)
  }

  // Everyone else sees only their own record for the date
  const record = await readEodByUserAndDate(session.id, date)
  return NextResponse.json(record ? [record] : [])
}

// ─── POST /api/eod ────────────────────────────────────────────────────────────
// Viewers cannot submit. Once-per-day enforced (unique user+date).

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'viewer') {
    return NextResponse.json({ error: 'Viewers cannot submit EOD forms' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const errors: string[] = []

  const date     = body.date     as string | undefined
  const locale   = body.locale   as string | undefined
  const workflow = body.workflow  as string | undefined
  const workset  = body.workset  as string | undefined

  if (!date   || !/^\d{4}-\d{2}-\d{2}$/.test(date))   errors.push('date is required (YYYY-MM-DD)')
  if (!locale)  errors.push('locale is required')
  if (!workflow) errors.push('workflow is required')
  if (!workset || (workset as string).trim() === '')    errors.push('workset is required')

  const numReports        = typeof body.numReports        === 'number' ? body.numReports        : 0
  const minutesCompleted  = typeof body.minutesCompleted  === 'number' ? body.minutesCompleted  : 0
  const minutesTranscribed = typeof body.minutesTranscribed === 'number' ? body.minutesTranscribed : 0
  const owReviewRework    = typeof body.owReviewRework    === 'number' ? body.owReviewRework    : 0
  const owItTraining      = typeof body.owItTraining      === 'number' ? body.owItTraining      : 0
  const owNeat            = typeof body.owNeat            === 'number' ? body.owNeat            : 0
  const owWaiting         = typeof body.owWaiting         === 'number' ? body.owWaiting         : 0
  const phTranscribing    = typeof body.phTranscribing    === 'number' ? body.phTranscribing    : 0
  const phIaa             = typeof body.phIaa             === 'number' ? body.phIaa             : 0
  const phPhi             = typeof body.phPhi             === 'number' ? body.phPhi             : 0
  const remarks           = typeof body.remarks           === 'string' ? body.remarks           : ''

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 422 })
  }

  try {
    const created = await addEodSubmission({
      userId:            session.id,
      userName:          session.name,
      userLocale:        session.locale,
      date:              date!,
      locale:            locale!,
      workflow:          workflow!,
      workset:           (workset as string).trim(),
      numReports,
      minutesCompleted,
      minutesTranscribed,
      owReviewRework,
      owItTraining,
      owNeat,
      owWaiting,
      phTranscribing,
      phIaa,
      phPhi,
      remarks:           remarks.trim(),
    })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Supabase unique constraint violation
    if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
      return NextResponse.json(
        { error: 'You have already submitted an EOD for this date. Use PATCH to update.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── PATCH /api/eod?id= ───────────────────────────────────────────────────────
// Blocked after 17:30 Madrid time (except admins).

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'viewer') {
    return NextResponse.json({ error: 'Viewers cannot edit EOD submissions' }, { status: 403 })
  }

  // Non-admins are locked out after 17:30 Madrid time
  if (session.role !== 'admin' && session.role !== 'pm' && isPastEditLock()) {
    return NextResponse.json(
      { error: 'EOD submissions are locked after 17:30 Madrid time.' },
      { status: 423 }, // Locked
    )
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const updates: Parameters<typeof updateEodSubmission>[1] = {}
  if (body.locale             !== undefined) updates.locale              = body.locale             as string
  if (body.workflow           !== undefined) updates.workflow            = body.workflow            as string
  if (body.workset            !== undefined) updates.workset             = (body.workset as string).trim()
  if (body.numReports         !== undefined) updates.numReports          = body.numReports         as number
  if (body.minutesCompleted   !== undefined) updates.minutesCompleted    = body.minutesCompleted   as number
  if (body.minutesTranscribed !== undefined) updates.minutesTranscribed  = body.minutesTranscribed as number
  if (body.owReviewRework     !== undefined) updates.owReviewRework      = body.owReviewRework     as number
  if (body.owItTraining       !== undefined) updates.owItTraining        = body.owItTraining       as number
  if (body.owNeat             !== undefined) updates.owNeat              = body.owNeat             as number
  if (body.owWaiting          !== undefined) updates.owWaiting           = body.owWaiting          as number
  if (body.phTranscribing     !== undefined) updates.phTranscribing      = body.phTranscribing     as number
  if (body.phIaa              !== undefined) updates.phIaa               = body.phIaa              as number
  if (body.phPhi              !== undefined) updates.phPhi               = body.phPhi              as number
  if (body.remarks            !== undefined) updates.remarks             = body.remarks            as string

  const updated = await updateEodSubmission(id, updates)
  return NextResponse.json(updated)
}

// ─── DELETE /api/eod?id= ──────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'pm') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await deleteEodSubmission(id)
  return NextResponse.json({ ok: true })
}

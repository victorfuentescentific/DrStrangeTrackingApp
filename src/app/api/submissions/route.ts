import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  readSubmissions,
  addSubmission,
  type Submission,
} from '@/lib/submissions'

// ─── Enums ────────────────────────────────────────────────────────────────────

const VALID_WORKFLOWS = ['DAX', 'DMO', 'Scribing'] as const
const VALID_PHASES = ['1P+IAA', '2P', 'PHI', 'Review'] as const

type Workflow = (typeof VALID_WORKFLOWS)[number]
type Phase = (typeof VALID_PHASES)[number]

function isWorkflow(v: unknown): v is Workflow {
  return VALID_WORKFLOWS.includes(v as Workflow)
}

function isPhase(v: unknown): v is Phase {
  return VALID_PHASES.includes(v as Phase)
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// ─── GET /api/submissions ─────────────────────────────────────────────────────
// Query params: userId?, date?, from?, to?
// Freelancers can only see their own submissions. Admins can see all.

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const qUserId = searchParams.get('userId')
  const qDate = searchParams.get('date')
  const qFrom = searchParams.get('from')
  const qTo = searchParams.get('to')

  // Freelancers may only view their own submissions
  if (session.role === 'freelancer' && qUserId && qUserId !== session.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let submissions = await readSubmissions()

  // Scope freelancers to themselves even if no userId param was provided
  const effectiveUserId =
    session.role === 'freelancer' ? session.id : (qUserId ?? null)

  if (effectiveUserId) {
    submissions = submissions.filter((s) => s.userId === effectiveUserId)
  }

  if (qDate) {
    submissions = submissions.filter((s) => s.date === qDate)
  } else if (qFrom && qTo) {
    submissions = submissions.filter(
      (s) => s.date >= qFrom && s.date <= qTo
    )
  } else if (qFrom) {
    submissions = submissions.filter((s) => s.date >= qFrom)
  } else if (qTo) {
    submissions = submissions.filter((s) => s.date <= qTo)
  }

  return NextResponse.json(submissions)
}

// ─── POST /api/submissions ────────────────────────────────────────────────────
// Body: Omit<Submission, 'id' | 'submittedAt'>
// Freelancer's userId is always taken from the session.

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Field extraction ──────────────────────────────────────────────────────

  // Freelancers cannot submit on behalf of others
  const userId =
    session.role === 'freelancer' ? session.id : (body.userId as string)
  const userName =
    session.role === 'freelancer'
      ? session.name
      : (body.userName as string)

  const userLocale: string | null =
    typeof body.userLocale === 'string' ? body.userLocale : (session.locale ?? null)

  const date = body.date as string
  const locale = body.locale as string
  const workflow = body.workflow
  const phase = body.phase
  const worksetId: string | null =
    typeof body.worksetId === 'string' ? body.worksetId : null
  const worksetName: string | null =
    typeof body.worksetName === 'string' ? body.worksetName : null
  const hours = body.hours
  const notes = typeof body.notes === 'string' ? body.notes : ''

  // ── Validation ────────────────────────────────────────────────────────────

  const errors: string[] = []

  if (!userId || typeof userId !== 'string') {
    errors.push('userId is required')
  }
  if (!userName || typeof userName !== 'string') {
    errors.push('userName is required')
  }

  // date: required, YYYY-MM-DD, not in the future
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('date must be a valid YYYY-MM-DD string')
  } else {
    const today = new Date().toISOString().slice(0, 10)
    if (date > today) {
      errors.push('date cannot be in the future')
    }
  }

  if (!locale || typeof locale !== 'string') {
    errors.push('locale is required')
  }

  if (!isWorkflow(workflow)) {
    errors.push(`workflow must be one of: ${VALID_WORKFLOWS.join(', ')}`)
  }

  if (!isPhase(phase)) {
    errors.push(`phase must be one of: ${VALID_PHASES.join(', ')}`)
  }

  if (
    typeof hours !== 'number' ||
    hours < 0.5 ||
    hours > 8 ||
    Math.round(hours * 2) !== hours * 2
  ) {
    errors.push('hours must be a number in 0.5 increments between 0.5 and 8')
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 422 })
  }

  // ── Persist ───────────────────────────────────────────────────────────────

  const payload: Omit<Submission, 'id' | 'submittedAt'> = {
    userId: userId as string,
    userName: userName as string,
    userLocale,
    date,
    locale,
    workflow: workflow as Workflow,
    phase: phase as Phase,
    worksetId,
    worksetName,
    hours: hours as number,
    notes,
  }

  const created = await addSubmission(payload)
  return NextResponse.json(created, { status: 201 })
}

// ─── PATCH /api/submissions?id= ───────────────────────────────────────────────
// Admin only. Updates mutable fields on an existing submission.

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const updates: Record<string, unknown> = {}
  if (body.date     !== undefined) updates.date     = body.date
  if (body.locale   !== undefined) updates.locale   = body.locale
  if (body.workflow !== undefined) updates.workflow  = body.workflow
  if (body.phase    !== undefined) updates.phase    = body.phase
  if (body.hours    !== undefined) updates.hours    = body.hours
  if (body.notes    !== undefined) updates.notes    = body.notes

  const { error } = await db.from('submissions').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ─── DELETE /api/submissions?id= ──────────────────────────────────────────────
// Admin only.

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await db.from('submissions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

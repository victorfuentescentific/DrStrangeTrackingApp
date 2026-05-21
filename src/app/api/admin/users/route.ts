import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// ── GET /api/admin/users — full user list with all fields ─────────────────────

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await db
    .from('users')
    .select(
      'id, name, email, role, employee_type, locale, workflow, is_active, ' +
      'emp_id, v_microsoft_email, ms_id, one_forma_id, personal_email, phone, ' +
      'shipping_address, start_date, batch, centific_type, role_designation, ' +
      'billable, overall_status, ms_account_status, phone_status, laptop_status, ' +
      'bgc_request_date, bgc_status, identity_check_date, remarks'
    )
    .order('role')
    .order('employee_type')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ── PATCH /api/admin/users — update a single user ────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    id:                 string
    password?:          string
    name?:              string
    email?:             string
    role?:              string
    locale?:            string | null
    employeeType?:      string | null
    workflow?:          string | null
    isActive?:          boolean
    empId?:             string | null
    vMicrosoftEmail?:   string | null
    msId?:              string | null
    oneFormaId?:        string | null
    personalEmail?:     string | null
    phone?:             string | null
    shippingAddress?:   string | null
    startDate?:         string | null
    batch?:             string | null
    centificType?:      string | null
    roleDesignation?:   string | null
    billable?:          boolean | null
    overallStatus?:     string | null
    msAccountStatus?:   string | null
    phoneStatus?:       string | null
    laptopStatus?:      string | null
    bgcRequestDate?:    string | null
    bgcStatus?:         string | null
    identityCheckDate?: string | null
    remarks?:           string | null
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 422 })

  const updates: Record<string, unknown> = {}

  if (body.password !== undefined) {
    if (body.password.length < 6)
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 422 })
    updates.password_hash = await bcrypt.hash(body.password, 10)
  }

  if (body.name               !== undefined) updates.name               = body.name
  if (body.email              !== undefined) updates.email              = body.email
  if (body.role               !== undefined) updates.role               = body.role
  if (body.locale             !== undefined) updates.locale             = body.locale ?? null
  if (body.employeeType       !== undefined) updates.employee_type      = body.employeeType ?? null
  if (body.workflow           !== undefined) updates.workflow           = body.workflow ?? null
  if (body.isActive           !== undefined) updates.is_active          = body.isActive
  if (body.empId              !== undefined) updates.emp_id             = body.empId ?? null
  if (body.vMicrosoftEmail    !== undefined) updates.v_microsoft_email  = body.vMicrosoftEmail ?? null
  if (body.msId               !== undefined) updates.ms_id              = body.msId ?? null
  if (body.oneFormaId         !== undefined) updates.one_forma_id       = body.oneFormaId ?? null
  if (body.personalEmail      !== undefined) updates.personal_email     = body.personalEmail ?? null
  if (body.phone              !== undefined) updates.phone              = body.phone ?? null
  if (body.shippingAddress    !== undefined) updates.shipping_address   = body.shippingAddress ?? null
  if (body.startDate          !== undefined) updates.start_date         = body.startDate ?? null
  if (body.batch              !== undefined) updates.batch              = body.batch ?? null
  if (body.centificType       !== undefined) updates.centific_type      = body.centificType ?? null
  if (body.roleDesignation    !== undefined) updates.role_designation   = body.roleDesignation ?? null
  if (body.billable           !== undefined) updates.billable           = body.billable ?? null
  if (body.overallStatus      !== undefined) updates.overall_status     = body.overallStatus ?? null
  if (body.msAccountStatus    !== undefined) updates.ms_account_status  = body.msAccountStatus ?? null
  if (body.phoneStatus        !== undefined) updates.phone_status       = body.phoneStatus ?? null
  if (body.laptopStatus       !== undefined) updates.laptop_status      = body.laptopStatus ?? null
  if (body.bgcRequestDate     !== undefined) updates.bgc_request_date   = body.bgcRequestDate ?? null
  if (body.bgcStatus          !== undefined) updates.bgc_status         = body.bgcStatus ?? null
  if (body.identityCheckDate  !== undefined) updates.identity_check_date = body.identityCheckDate ?? null
  if (body.remarks            !== undefined) updates.remarks            = body.remarks ?? null

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 422 })

  const { error } = await db.from('users').update(updates).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

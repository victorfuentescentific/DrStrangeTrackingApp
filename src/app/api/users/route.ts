import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { db } from '@/lib/db'

export interface UserSummary {
  id: string
  name: string
  role: string
  locale: string | null
  employeeType: string | null
  workflow: string | null
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await verifyToken(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only admins and PMs can fetch the full user list
  if (session.role === 'freelancer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await db
    .from('users')
    .select('id, name, role, locale, employee_type, workflow')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users: UserSummary[] = (data ?? []).map(u => ({
    id:           u.id,
    name:         u.name,
    role:         u.role,
    locale:       u.locale ?? null,
    employeeType: u.employee_type ?? null,
    workflow:     u.workflow ?? null,
  }))

  return NextResponse.json(users)
}

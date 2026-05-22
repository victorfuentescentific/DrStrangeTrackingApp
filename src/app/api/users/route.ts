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

// Reads from accounts_credentials — the single source of truth for user data.
// Only returns Active users; inactive/offboarded are excluded from team views.
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await verifyToken(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const baseQuery = db
    .from('Account credentials')
    .select('id, name, role, locale, resource_type, workflow')
    .eq('status', 'Active')

  const scopedQuery =
    (session.role === 'fte' || session.role === 'freelancer') && session.locale
      ? baseQuery.eq('locale', session.locale)
      : baseQuery

  const { data, error } = await scopedQuery.order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users: UserSummary[] = (data ?? []).map(u => ({
    id:           u.id,
    name:         u.name,
    role:         u.role,
    locale:       u.locale ?? null,
    employeeType: u.resource_type ?? null,
    workflow:     u.workflow ?? null,
  }))

  return NextResponse.json(users)
}

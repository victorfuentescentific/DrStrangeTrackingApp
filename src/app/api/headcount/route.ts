import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import {
  getAllHeadcount,
  filterHeadcount,
  computeAnalytics,
  distinctValues,
  HeadcountFilters,
} from '@/lib/headcount'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// GET /api/headcount?locale=&workflow=&resourceType=&status=&search=&analytics=1
// Headcount data contains PII; restricted to admin + lead (PM) roles only.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.role !== 'admin' && session.role !== 'lead') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const filters: HeadcountFilters = {
    locale:       sp.get('locale')       || undefined,
    workflow:     sp.get('workflow')     || undefined,
    resourceType: sp.get('resourceType') || undefined,
    status:       sp.get('status')       || undefined,
    search:       sp.get('search')       || undefined,
  }

  const all      = getAllHeadcount()
  const filtered = filterHeadcount(all, filters)

  const wantAnalytics = sp.get('analytics') === '1'
  if (wantAnalytics) {
    return NextResponse.json({
      records: filtered,
      analytics: computeAnalytics(filtered),
      facets: {
        locales:        distinctValues(all, 'locale'),
        workflows:      distinctValues(all, 'workflow'),
        resourceTypes:  distinctValues(all, 'resourceType'),
        statuses:       distinctValues(all, 'status'),
      },
    })
  }

  return NextResponse.json({
    records: filtered,
    facets: {
      locales:       distinctValues(all, 'locale'),
      workflows:     distinctValues(all, 'workflow'),
      resourceTypes: distinctValues(all, 'resourceType'),
      statuses:      distinctValues(all, 'status'),
    },
  })
}

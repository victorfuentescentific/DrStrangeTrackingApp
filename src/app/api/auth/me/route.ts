import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const user = await verifyToken(token)
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired session' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, user })
}

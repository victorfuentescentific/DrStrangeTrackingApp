import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai/debug
//
// Temporary diagnostic endpoint — admin only.
// Returns the first 8 characters of GEMINI_API_KEY so we can verify which
// key Vercel actually has deployed. Delete this route once the key is confirmed.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = verifyToken(token)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const key = process.env.GEMINI_API_KEY ?? ''

  return NextResponse.json({
    keySet:   key.length > 0,
    keyLen:   key.length,
    keyStart: key.length >= 8 ? key.slice(0, 8) + '...' : '(too short)',
    note:     'Delete this endpoint once the key is confirmed correct.',
  })
}

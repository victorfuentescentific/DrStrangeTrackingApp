import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { askAI } from '@/lib/ai-provider'
import { getAllHeadcount, computeAnalytics } from '@/lib/headcount'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/chat
//
// Body: { prompt: string, contextSlice?: 'headcount' | 'none' }
//
// When `contextSlice` is provided, the route fetches the relevant portal data,
// reduces it to aggregates (no PII — no names, no employee IDs, no emails),
// and prepends it to the user prompt so the model has real numbers to reason
// over. Free-form chat (`contextSlice: 'none'` or omitted) sends only the
// user's prompt with a generic system instruction.
//
// Admin + Lead only. The model used is configured in src/lib/ai-provider.ts.
// ─────────────────────────────────────────────────────────────────────────────

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

const SYSTEM_INSTRUCTION = `You are an AI assistant embedded in the Dr. Strange Portal,
an internal operations tool for the Centific EU LLM Data team. You help project
managers (admins) and team leads analyze workload, headcount, availability, and
project status.

Style:
- Be concise. Prefer bullet points and short paragraphs over long prose.
- When the user provides portal data as context, ground your answer in it.
- If the data doesn't contain what's needed to answer, say so plainly.
- Never fabricate names, IDs, dates, or numbers. If unsure, say "I don't have
  that data in this context."
- For status updates and summaries, lead with the headline finding, then back
  it up with the supporting numbers.`.trim()

// Build a sanitized aggregate slice of the headcount data — no PII.
async function buildHeadcountContext(): Promise<string> {
  try {
    const records = await getAllHeadcount()
    const analytics = computeAnalytics(records)

    const lines: string[] = []
    lines.push('=== HEADCOUNT SNAPSHOT (aggregates only — no PII) ===')
    lines.push(`Total records: ${analytics.total} | Active: ${analytics.active} | Inactive: ${analytics.inactive} | Offboarded: ${analytics.offboarded}`)
    lines.push('')

    const fmtGroup = (title: string, group: Record<string, { active: number; inactive: number; offboarded: number; total: number }>) => {
      lines.push(title)
      const entries = Object.entries(group).sort((a, b) => b[1].total - a[1].total)
      for (const [key, v] of entries) {
        lines.push(`  - ${key}: ${v.total} total (${v.active} active, ${v.inactive} inactive, ${v.offboarded} offboarded)`)
      }
      lines.push('')
    }

    fmtGroup('By Locale:', analytics.byLocale)
    fmtGroup('By Workflow:', analytics.byWorkflow)
    fmtGroup('By Resource Type:', analytics.byResourceType)
    fmtGroup('By Role:', analytics.byRole)
    fmtGroup('By Position:', analytics.byPosition)

    // Onboarding-status counts (computed directly from records since
    // computeAnalytics doesn't bucket by onboarding status).
    const onboarding: Record<string, number> = {}
    for (const r of records) {
      const k = r.onboardingStatus?.trim() || '—'
      onboarding[k] = (onboarding[k] ?? 0) + 1
    }
    lines.push('By Onboarding Status:')
    for (const [k, n] of Object.entries(onboarding).sort((a, b) => b[1] - a[1])) {
      lines.push(`  - ${k}: ${n}`)
    }
    return lines.join('\n')
  } catch (err) {
    return `(headcount context unavailable: ${(err as Error).message})`
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'lead') {
    return NextResponse.json({ error: 'Forbidden — AI Assistant is restricted to admin and lead roles.' }, { status: 403 })
  }

  let body: { prompt?: unknown; contextSlice?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  const contextSlice = typeof body.contextSlice === 'string' ? body.contextSlice : 'none'

  if (!prompt) return NextResponse.json({ error: 'Missing or empty prompt' }, { status: 400 })
  if (prompt.length > 8000) return NextResponse.json({ error: 'Prompt is too long (max 8000 chars)' }, { status: 400 })

  // Build the final prompt with any requested context slice prepended.
  let finalPrompt = prompt
  if (contextSlice === 'headcount') {
    const ctx = await buildHeadcountContext()
    finalPrompt = `${ctx}\n\n=== USER QUESTION ===\n${prompt}`
  }

  const result = await askAI(finalPrompt, { systemInstruction: SYSTEM_INSTRUCTION })
  if (!result.ok) {
    return NextResponse.json({ error: result.error, model: result.model }, { status: 502 })
  }

  return NextResponse.json({ text: result.text, model: result.model })
}

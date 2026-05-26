import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { askAI } from '@/lib/ai-provider'
import { getAllHeadcount, computeAnalytics } from '@/lib/headcount'
import { db } from '@/lib/db'
import { createRateLimiter } from '@/lib/rate-limit'
import type { Workset } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/chat
//
// Body: { prompt: string, contextSlice?: 'headcount' | 'worksets' | 'none' }
//
// Each contextSlice fetches a PII-safe data snapshot from the portal and
// prepends it to the prompt so the model can answer grounded in real data.
// Free-form chat ('none') sends only the user prompt.
//
// Admin + Lead only. 20 requests / user / hour to stay within Gemini free tier.
// ─────────────────────────────────────────────────────────────────────────────

// 20 requests per user per hour — well inside Gemini free tier (1,500/day total)
const aiLimiter = createRateLimiter({ max: 20, windowMs: 60 * 60 * 1000 })

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
  it up with the supporting numbers.
- Keep responses under 400 words unless specifically asked for a longer format.`.trim()

// ── Context builders ──────────────────────────────────────────────────────────

async function buildHeadcountContext(): Promise<string> {
  try {
    const records = await getAllHeadcount()
    const analytics = computeAnalytics(records)

    const lines: string[] = []
    lines.push('=== HEADCOUNT SNAPSHOT (aggregates only — no names or IDs) ===')
    lines.push(`Total: ${analytics.total} | Active: ${analytics.active} | Inactive: ${analytics.inactive} | Offboarded: ${analytics.offboarded}`)
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

async function buildWorksetsContext(): Promise<string> {
  try {
    const { data, error } = await db
      .from('worksets')
      .select('name, workset_id, workflow, locale, status, priority, risk_level, eta, revised_eta, is_blocked, blocker_description, is_escalated, team_size, start_date')
      .neq('status', 'completed')
      .order('created_at', { ascending: false })

    if (error) return `(worksets context unavailable: ${error.message})`

    const rows = (data ?? []) as Record<string, unknown>[]
    const today = new Date().toISOString().split('T')[0]

    const lines: string[] = []
    lines.push('=== ACTIVE WORKSETS SNAPSHOT ===')
    lines.push(`Total active (non-completed): ${rows.length} | As of: ${today}`)
    lines.push('')

    // Overdue
    const overdue = rows.filter(r => {
      const eta = (r.revised_eta ?? r.eta) as string
      return eta && eta < today && r.status !== 'completed'
    })

    // Blocked
    const blocked = rows.filter(r => r.is_blocked === true)

    // Escalated
    const escalated = rows.filter(r => r.is_escalated === true)

    // High/critical risk
    const highRisk = rows.filter(r => r.risk_level === 'high' || r.risk_level === 'critical')

    lines.push(`Summary: ${overdue.length} overdue | ${blocked.length} blocked | ${escalated.length} escalated | ${highRisk.length} high/critical risk`)
    lines.push('')

    if (overdue.length > 0) {
      lines.push('Overdue worksets:')
      overdue.forEach(r => {
        const eta = (r.revised_eta ?? r.eta) as string
        const daysOver = Math.round((new Date(today).getTime() - new Date(eta).getTime()) / 86400000)
        lines.push(`  - ${r.workset_id} | ${r.name} | ${r.locale} | ${r.workflow} | ${daysOver}d overdue | risk: ${r.risk_level}`)
      })
      lines.push('')
    }

    if (blocked.length > 0) {
      lines.push('Blocked worksets:')
      blocked.forEach(r => {
        lines.push(`  - ${r.workset_id} | ${r.name} | ${r.locale} | blocker: ${r.blocker_description ?? 'not described'}`)
      })
      lines.push('')
    }

    if (escalated.length > 0) {
      lines.push('Escalated worksets:')
      escalated.forEach(r => {
        lines.push(`  - ${r.workset_id} | ${r.name} | ${r.locale} | ${r.workflow}`)
      })
      lines.push('')
    }

    // Status breakdown
    const statusBucket: Record<string, number> = {}
    for (const r of rows) {
      const s = (r.status as string) || '—'
      statusBucket[s] = (statusBucket[s] ?? 0) + 1
    }
    lines.push('Status breakdown:')
    for (const [k, n] of Object.entries(statusBucket).sort((a, b) => b[1] - a[1])) {
      lines.push(`  - ${k}: ${n}`)
    }
    lines.push('')

    // Workflow breakdown
    const wfBucket: Record<string, number> = {}
    for (const r of rows) {
      const wf = (r.workflow as string) || '—'
      wfBucket[wf] = (wfBucket[wf] ?? 0) + 1
    }
    lines.push('Workflow breakdown:')
    for (const [k, n] of Object.entries(wfBucket)) {
      lines.push(`  - ${k}: ${n}`)
    }

    return lines.join('\n')
  } catch (err) {
    return `(worksets context unavailable: ${(err as Error).message})`
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'lead') {
    return NextResponse.json({ error: 'AI Assistant is restricted to admin and lead roles.' }, { status: 403 })
  }

  // Per-user rate limit
  const limit = aiLimiter.check(session.id)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit reached (20 requests/hour). Try again later.' },
      { status: 429 },
    )
  }

  let body: { prompt?: unknown; contextSlice?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  const contextSlice = typeof body.contextSlice === 'string' ? body.contextSlice : 'none'

  if (!prompt) return NextResponse.json({ error: 'Missing or empty prompt' }, { status: 400 })
  if (prompt.length > 8000) return NextResponse.json({ error: 'Prompt is too long (max 8,000 chars)' }, { status: 400 })

  // Build context prefix
  let contextPrefix = ''
  if (contextSlice === 'headcount') {
    contextPrefix = await buildHeadcountContext()
  } else if (contextSlice === 'worksets') {
    contextPrefix = await buildWorksetsContext()
  }

  const finalPrompt = contextPrefix
    ? `${contextPrefix}\n\n=== USER QUESTION ===\n${prompt}`
    : prompt

  const result = await askAI(finalPrompt, { systemInstruction: SYSTEM_INSTRUCTION })
  if (!result.ok) {
    return NextResponse.json({ error: result.error, model: result.model }, { status: 502 })
  }

  return NextResponse.json({ text: result.text, model: result.model })
}

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Send, Loader2, AlertTriangle, User, Bot, Zap,
  Users, BookOpenCheck, CalendarClock, ListTodo, RefreshCw,
  AlertOctagon, Shield,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'

// ─────────────────────────────────────────────────────────────────────────────
// AI Assistant — chat-style page for asking questions about portal data.
//
// Talks to /api/ai/chat. The backend model is currently Gemini 2.0 Flash but
// the page is model-agnostic — when we swap providers we don't touch this file.
//
// Quick Actions prebuild prompts and pull portal context (e.g. headcount
// aggregates) on the server side. Free-form chat doesn't attach any context.
// ─────────────────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant'
type ContextSlice = 'headcount' | 'worksets' | 'none'

interface Message {
  id: string
  role: Role
  text: string
  model?: string
  contextSlice?: ContextSlice
}

interface QuickAction {
  label: string
  icon: typeof Users
  prompt: string
  contextSlice: ContextSlice
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Summarize headcount by locale',
    icon: Users,
    prompt: 'Summarize our current headcount snapshot by locale. Highlight which locales have the most active staff, which have the lowest active counts, and call out any locale where onboarding-in-progress counts are notably high relative to total.',
    contextSlice: 'headcount',
  },
  {
    label: 'Centific vs Contractor mix',
    icon: BookOpenCheck,
    prompt: 'Break down the team by resource type (Centific employees vs contractors). What percentage are contractors? Are there workflows that lean heavily one way or the other?',
    contextSlice: 'headcount',
  },
  {
    label: 'Onboarding bottlenecks',
    icon: CalendarClock,
    prompt: 'Look at the onboarding-status distribution. Which statuses have the largest backlogs? What proportion of total headcount is still in onboarding vs fully onboarded? Suggest where to focus.',
    contextSlice: 'headcount',
  },
  {
    label: 'Draft a weekly status update',
    icon: ListTodo,
    prompt: 'Draft a concise weekly status update for leadership based on the current headcount snapshot. Cover: total active team size, locale coverage, resource-type mix, and any notable onboarding or offboarding trends. Keep it under 150 words, executive tone.',
    contextSlice: 'headcount',
  },
  {
    label: 'Workset risk & blockers',
    icon: AlertOctagon,
    prompt: 'Review the active worksets. Which are overdue or blocked? Summarize the top risks and suggest immediate PM actions. Group by severity.',
    contextSlice: 'worksets',
  },
  {
    label: 'Project status overview',
    icon: Shield,
    prompt: 'Give me a quick project health overview: how many worksets are on track vs at risk vs overdue? What workflows and locales are most affected? Keep it under 200 words.',
    contextSlice: 'worksets',
  },
]

export default function AIAssistantPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reqCount, setReqCount] = useState(0)   // tracked client-side (approx)
  const scrollRef = useRef<HTMLDivElement>(null)
  const MAX_REQ = 20

  // Auth gate — admin + lead only (matches the API route gate).
  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.status === 401) { router.push('/login'); return null }
      return r.json()
    }).then(me => {
      if (!me) return
      const role = me?.user?.role
      if (role !== 'admin' && role !== 'lead') {
        router.push('/')
        return
      }
      setAuthed(true)
    })
  }, [router])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const send = useCallback(async (prompt: string, contextSlice: ContextSlice = 'none') => {
    const trimmed = prompt.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      contextSlice,
    }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, contextSlice }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Request failed (HTTP ${res.status})`)
      } else {
        const aiMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.text,
          model: data.model,
        }
        setMessages(m => [...m, aiMsg])
        setReqCount(c => c + 1)
      }
    } catch (err) {
      setError(`Network error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [loading])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  if (!authed) {
    return (
      <AppLayout title="AI Assistant" subtitle="Loading…">
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="AI Assistant" subtitle="Ask questions about your team, headcount, and project status">
      <div className="max-w-5xl mx-auto">

        {/* Banner — data-handling notice */}
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-xs text-amber-900 leading-relaxed">
            <span className="font-semibold">Heads up — data handling.</span>{' '}
            Quick Actions send only aggregate counts (no names, IDs, or emails) to the AI model. Free-form
            chat is unrestricted — please don&apos;t paste sensitive employee data (names, salaries, IDs)
            unless you&apos;ve cleared it with IT/security.
          </div>
          <div className="flex-shrink-0 text-right">
            <div className={`text-[11px] font-semibold tabular-nums ${reqCount >= MAX_REQ - 3 ? 'text-red-600' : 'text-amber-700'}`}>
              {MAX_REQ - reqCount}/{MAX_REQ}
            </div>
            <div className="text-[10px] text-amber-600">requests/hr</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">

          {/* Quick Actions panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
            </div>
            <div className="p-3 space-y-2">
              {QUICK_ACTIONS.map(action => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    onClick={() => send(action.prompt, action.contextSlice)}
                    disabled={loading || reqCount >= MAX_REQ}
                    className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left border border-slate-200 hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                  >
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-brand-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 group-hover:text-slate-900 leading-snug">
                        {action.label}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {action.contextSlice === 'headcount' ? '📊 headcount data' : action.contextSlice === 'worksets' ? '📋 workset data' : 'no portal data'}
                      </p>
                    </div>
                  </button>
                )
              })}
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-3 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Clear conversation
                </button>
              )}
            </div>
            <div className="px-4 pb-4">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Quick Actions pull aggregated portal data automatically. You can still tweak the result by
                asking follow-up questions in the chat.
              </p>
            </div>
          </div>

          {/* Chat panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col" style={{ height: 'calc(100vh - 240px)', minHeight: '500px' }}>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
                  <Sparkles className="w-10 h-10 text-brand-300 mb-3" />
                  <p className="text-sm font-medium text-slate-600">Ask me anything about your team</p>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
                    Try a Quick Action on the left, or type a question below to start.
                  </p>
                </div>
              )}

              {messages.map(m => (
                <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={
                    m.role === 'user'
                      ? 'max-w-[85%] flex items-start gap-2.5 flex-row-reverse'
                      : 'max-w-[85%] flex items-start gap-2.5'
                  }>
                    <div className={
                      m.role === 'user'
                        ? 'w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white flex-shrink-0'
                        : 'w-7 h-7 rounded-full bg-gradient-to-br from-accent-700 to-deep-900 flex items-center justify-center text-brand-200 flex-shrink-0'
                    }>
                      {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>
                    <div className={
                      m.role === 'user'
                        ? 'bg-brand-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap'
                        : 'bg-slate-50 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap border border-slate-100'
                    }>
                      {m.text}
                      {m.role === 'assistant' && m.model && (
                        <div className="text-[10px] text-slate-400 mt-2 font-mono">{m.model}</div>
                      )}
                      {m.role === 'user' && m.contextSlice && m.contextSlice !== 'none' && (
                        <div className="text-[10px] text-brand-100 mt-2 inline-flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" />
                          context: {m.contextSlice}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-700 to-deep-900 flex items-center justify-center text-brand-200 flex-shrink-0">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-3 border border-slate-100 inline-flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                      <span className="text-xs text-slate-500">Thinking…</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-start">
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 max-w-[85%]">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold mb-0.5">Request failed</div>
                        <div className="text-xs">{error}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 p-3">
              <form
                onSubmit={e => { e.preventDefault(); send(input, 'none') }}
                className="flex gap-2"
              >
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send(input, 'none')
                    }
                  }}
                  placeholder="Ask a question… (Shift+Enter for new line)"
                  rows={1}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 resize-none disabled:bg-slate-50"
                  style={{ maxHeight: '120px' }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 text-white transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </form>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  )
}

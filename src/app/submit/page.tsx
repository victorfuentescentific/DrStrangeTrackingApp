'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, Minus, Plus, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowType } from '@/lib/types'
import { SessionUser } from '@/lib/auth'

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCALES = ['en_GB', 'de_DE', 'nl_NL', 'fr_FR', 'da_DK', 'nb_NO'] as const
type Locale = (typeof LOCALES)[number]

type Phase = '1P+IAA' | '2P' | 'PHI' | 'Review'

const PHASES: { key: Phase; label: string; dot: string; ring: string; bg: string; text: string }[] = [
  { key: '1P+IAA', label: '1P + IAA', dot: 'bg-blue-500',   ring: 'ring-blue-400',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  { key: '2P',     label: '2P',       dot: 'bg-orange-400', ring: 'ring-orange-300', bg: 'bg-orange-50', text: 'text-orange-700' },
  { key: 'PHI',    label: 'PHI',      dot: 'bg-green-500',  ring: 'ring-green-400',  bg: 'bg-green-50',  text: 'text-green-700' },
  { key: 'Review', label: 'Review',   dot: 'bg-slate-400',  ring: 'ring-slate-300',  bg: 'bg-slate-100', text: 'text-slate-600' },
]

const WORKFLOWS: WorkflowType[] = ['DAX', 'DMO', 'Scribing']

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── HoursInput ───────────────────────────────────────────────────────────────

function HoursInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const segments = 8
  const filled = Math.round((value / 8) * segments)

  function decrement() {
    if (value > 0.5) onChange(Math.round((value - 0.5) * 10) / 10)
  }
  function increment() {
    if (value < 8) onChange(Math.round((value + 0.5) * 10) / 10)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={decrement}
          disabled={value <= 0.5}
          className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>

        <span className="text-4xl font-bold text-slate-800 tabular-nums w-20 text-center">
          {value % 1 === 0 ? `${value}.0` : value}
          <span className="text-base font-normal text-slate-500 ml-1">h</span>
        </span>

        <button
          type="button"
          onClick={increment}
          disabled={value >= 8}
          className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Visual bar: 8 segments */}
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-2 flex-1 rounded-full transition-colors',
              i < filled ? 'bg-brand-500' : 'bg-slate-200',
            )}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400">0.5 – 8 hours · use +/- to adjust</p>
    </div>
  )
}

// ─── SuccessCard ──────────────────────────────────────────────────────────────

interface SuccessData {
  date: string
  locale: string
  workflow: WorkflowType
  phase: Phase
  hours: number
}

function SuccessCard({ data, onAnother }: { data: SuccessData; onAnother: () => void }) {
  const phaseInfo = PHASES.find((p) => p.key === data.phase)!
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-4">
      <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
      <div>
        <p className="font-semibold text-green-800 text-lg">Hours logged successfully</p>
        <p className="text-sm text-green-700 mt-1">
          {data.date} &middot; {data.locale} &middot; {data.workflow} &middot; {phaseInfo.label} &middot; {data.hours}h
        </p>
      </div>
      <button
        type="button"
        onClick={onAnother}
        className="px-4 py-2 text-sm font-medium bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
      >
        Submit another day
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubmitPage() {
  const router = useRouter()

  // Auth state
  const [user, setUser] = useState<SessionUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Form state
  const [date, setDate] = useState(todayISO())
  const [locale, setLocale] = useState<Locale>('en_GB')
  const [workflow, setWorkflow] = useState<WorkflowType>('DAX')
  const [phase, setPhase] = useState<Phase>('1P+IAA')
  const [workset, setWorkset] = useState('')
  const [hours, setHours] = useState(4)
  const [notes, setNotes] = useState('')

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<SuccessData | null>(null)

  // ── Auth check on mount ──────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login')
          return null
        }
        if (!res.ok) return null
        return res.json()
      })
      .then((data) => {
        if (!data) return
        const u: SessionUser = data.user
        setUser(u)
        if (u.locale && (LOCALES as readonly string[]).includes(u.locale)) {
          setLocale(u.locale as Locale)
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setAuthLoading(false))
  }, [router])

  // ── Logout ───────────────────────────────────────────────────────────────
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, locale, workflow, phase, workset: workset.trim() || null, hours, notes: notes.trim() || null }),
    })

    setSubmitting(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Submission failed. Please try again.')
      return
    }

    setSuccess({ date, locale, workflow, phase, hours })
  }

  // ── Reset for another submission ─────────────────────────────────────────
  function resetForm() {
    setDate(todayISO())
    setWorkflow('DAX')
    setPhase('1P+IAA')
    setWorkset('')
    setHours(4)
    setNotes('')
    setError('')
    setSuccess(null)
  }

  // ── Loading spinner while checking auth ──────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">W</span>
          </div>
          <span className="font-semibold text-slate-800 text-sm">WorksetPM</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-slate-500">{user.name}</span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Log your hours</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record your daily work session</p>
        </div>

        {success ? (
          <SuccessCard data={success} onAnother={resetForm} />
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">

            {/* ── Date ── */}
            <div className="px-5 py-4 space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                Work date
              </label>
              <input
                type="date"
                required
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800"
              />
            </div>

            {/* ── Locale ── */}
            <div className="px-5 py-4 space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                Locale
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 bg-white"
              >
                {LOCALES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* ── Workflow ── */}
            <div className="px-5 py-4 space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                Workflow
              </label>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {WORKFLOWS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWorkflow(w)}
                    className={cn(
                      'flex-1 py-2 text-sm font-medium transition-colors',
                      workflow === w
                        ? 'bg-brand-500 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Phase ── */}
            <div className="px-5 py-4 space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                Phase
              </label>
              <div className="flex gap-2 flex-wrap">
                {PHASES.map((p) => {
                  const selected = phase === p.key
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPhase(p.key)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                        selected
                          ? cn(p.bg, p.text, 'border-transparent ring-2', p.ring)
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full', p.dot)} />
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Workset (optional) ── */}
            <div className="px-5 py-4 space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                Workset <span className="normal-case font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={workset}
                onChange={(e) => setWorkset(e.target.value)}
                placeholder="e.g. nl-nl_dmo_batch-a_hop"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 placeholder:text-slate-300"
              />
            </div>

            {/* ── Hours worked ── */}
            <div className="px-5 py-4 space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                Hours worked
              </label>
              <HoursInput value={hours} onChange={setHours} />
            </div>

            {/* ── Notes (optional) ── */}
            <div className="px-5 py-4 space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                Notes <span className="normal-case font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                placeholder="Any notes about your session..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 placeholder:text-slate-300 resize-none"
              />
              <p className="text-xs text-slate-400 text-right">{notes.length}/200</p>
            </div>

            {/* ── Error ── */}
            {error && (
              <div className="px-5 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* ── Submit ── */}
            <div className="px-5 py-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Submitting…' : 'Submit hours'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}

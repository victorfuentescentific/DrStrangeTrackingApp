'use client'

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, CheckCircle2, Minus, Plus, LogOut, ClipboardCheck,
  AlertCircle, Clock, Pencil, Lock, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SessionUser } from '@/lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EodRow {
  id: string
  date: string
  locale: string
  workflow: string
  workset: string
  numReports: number
  minutesCompleted: number
  minutesTranscribed: number
  owReviewRework: number
  owItTraining: number
  owNeat: number
  owWaiting: number
  phTranscribing: number
  phIaa: number
  phPhi: number
  remarks: string
  submittedAt: string
}

// ─── Spain-time helpers ───────────────────────────────────────────────────────

function getMadridNow(): Date {
  // Parse current Madrid time into a local Date object for arithmetic
  const str = new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })
  return new Date(str)
}

function getMadridHM(): { h: number; m: number } {
  const d = getMadridNow()
  return { h: d.getHours(), m: d.getMinutes() }
}

function isPastDeadline(): boolean {
  const { h } = getMadridHM()
  return h >= 17
}

function isPastEditLock(): boolean {
  const { h, m } = getMadridHM()
  return h > 17 || (h === 17 && m >= 30)
}

function isWarningWindow(): boolean {
  const { h, m } = getMadridHM()
  return h === 16 && m >= 30
}

function todayISO(): string {
  return getMadridNow().toISOString().split('T')[0]
}

function minutesUntil(targetH: number, targetM: number): number {
  const { h, m } = getMadridHM()
  return (targetH * 60 + targetM) - (h * 60 + m)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCALES = ['en_GB', 'de_DE', 'nl_NL', 'fr_FR', 'da_DK', 'nb_NO', 'fi_FI', 'sv_SE'] as const
const WORKFLOWS = ['DAX', 'DMO', 'Scribing'] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round1(v: number) { return Math.round(v * 10) / 10 }

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

// ─── NumInput ─────────────────────────────────────────────────────────────────

function NumInput({
  value, onChange, min = 0, max = 9999, step = 0.5, disabled = false, integer = false,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  integer?: boolean
}) {
  function clamp(v: number) {
    const r = integer ? Math.round(v) : round1(v)
    return Math.max(min, Math.min(max, r))
  }
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(clamp(value - step))}
        disabled={disabled || value <= min}
        className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number" value={value} min={min} max={max} step={integer ? 1 : step}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const v = integer ? parseInt(e.target.value) : parseFloat(e.target.value)
          if (!isNaN(v)) onChange(clamp(v))
        }}
        disabled={disabled}
        className="w-24 text-center px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 tabular-nums"
      />
      <button type="button" onClick={() => onChange(clamp(value + step))}
        disabled={disabled || value >= max}
        className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── SectionCard + FieldLabel ─────────────────────────────────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4', className)}>
      {children}
    </div>
  )
}

function FieldLabel({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return (
    <div className="mb-1.5">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

// ─── DeadlineBanner ───────────────────────────────────────────────────────────

function DeadlineBanner() {
  const [state, setState] = useState<'ok' | 'warning' | 'past' | 'locked'>('ok')
  const [minsLeft, setMinsLeft] = useState(0)

  useEffect(() => {
    function update() {
      if (isPastEditLock()) { setState('locked'); return }
      if (isPastDeadline()) { setState('past');   return }
      if (isWarningWindow()) {
        setState('warning')
        setMinsLeft(minutesUntil(17, 0))
        return
      }
      setState('ok')
      setMinsLeft(minutesUntil(16, 30))
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  if (state === 'ok') return null

  return (
    <div className={cn(
      'flex items-start gap-3 rounded-xl px-4 py-3 border mb-4',
      state === 'warning' && 'bg-amber-50 border-amber-300 text-amber-800',
      state === 'past'    && 'bg-orange-50 border-orange-300 text-orange-800',
      state === 'locked'  && 'bg-red-50 border-red-300 text-red-800',
    )}>
      {state === 'locked'
        ? <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
      <div className="text-sm">
        {state === 'warning' && (
          <><strong>{minsLeft} min</strong> until the 5 PM Madrid deadline — please submit soon.</>
        )}
        {state === 'past' && (
          <>Past the 5 PM Madrid deadline. Your submission is still accepted.</>
        )}
        {state === 'locked' && (
          <>EOD submissions are <strong>locked after 17:30 Madrid time</strong>. Contact your admin to update.</>
        )}
      </div>
    </div>
  )
}

// ─── EodForm ──────────────────────────────────────────────────────────────────

interface EodFormProps {
  session: SessionUser
  existing: EodRow | null     // today's existing submission if any
  readOnly: boolean
  onSaved: (row: EodRow) => void
}

function EodForm({ session, existing, readOnly, onSaved }: EodFormProps) {
  const isEdit    = !!existing
  const locked    = isPastEditLock() && session.role !== 'admin' && session.role !== 'pm'
  const disabled  = readOnly || locked

  const effectiveLocale = session.locale ?? 'en_GB'

  const [locale,              setLocale]              = useState(existing?.locale   ?? effectiveLocale)
  const [date,                setDate]                = useState(existing?.date     ?? todayISO())
  const [workflow,            setWorkflow]            = useState<string>(existing?.workflow ?? 'DAX')
  const [workset,             setWorkset]             = useState(existing?.workset  ?? '')
  const [numReports,          setNumReports]          = useState(existing?.numReports         ?? 0)
  const [minutesCompleted,    setMinutesCompleted]    = useState(existing?.minutesCompleted   ?? 0)
  const [minutesTranscribed,  setMinutesTranscribed]  = useState(existing?.minutesTranscribed ?? 0)
  const [owReviewRework,      setOwReviewRework]      = useState(existing?.owReviewRework  ?? 0)
  const [owItTraining,        setOwItTraining]        = useState(existing?.owItTraining    ?? 0)
  const [owNeat,              setOwNeat]              = useState(existing?.owNeat          ?? 0)
  const [owWaiting,           setOwWaiting]           = useState(existing?.owWaiting       ?? 0)
  const [phTranscribing,      setPhTranscribing]      = useState(existing?.phTranscribing  ?? 0)
  const [phIaa,               setPhIaa]               = useState(existing?.phIaa           ?? 0)
  const [phPhi,               setPhPhi]               = useState(existing?.phPhi           ?? 0)
  const [remarks,             setRemarks]             = useState(existing?.remarks         ?? '')
  const [submitting,          setSubmitting]          = useState(false)
  const [error,               setError]               = useState('')
  const [success,             setSuccess]             = useState(false)

  const totalOW   = round1(owReviewRework + owItTraining + owNeat + owWaiting)
  const totalPH   = round1(phTranscribing + phIaa + phPhi)
  const totalHours = round1(totalOW + totalPH)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const errs: string[] = []
    if (!date)              errs.push('Date is required.')
    if (!locale)            errs.push('Locale is required.')
    if (!workflow)          errs.push('Workflow is required.')
    if (!workset.trim())    errs.push('Workset is required.')
    if (numReports === 0 && minutesCompleted === 0 && minutesTranscribed === 0)
      errs.push('At least one Production Metric must be filled.')
    if (phTranscribing === 0 && phIaa === 0 && phPhi === 0 && owReviewRework === 0 && owItTraining === 0 && owNeat === 0 && owWaiting === 0)
      errs.push('At least one Hours field must be filled.')
    if (!remarks.trim())    errs.push('Remarks are required.')
    if (errs.length > 0) { setError(errs.join(' ')); return }

    setSubmitting(true)
    const body = {
      date, locale, workflow, workset: workset.trim(),
      numReports, minutesCompleted, minutesTranscribed,
      owReviewRework, owItTraining, owNeat, owWaiting,
      phTranscribing, phIaa, phPhi,
      remarks: remarks.trim(),
    }

    const url    = isEdit ? `/api/eod?id=${existing!.id}` : '/api/eod'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSubmitting(false)

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? 'Submission failed. Please try again.')
      return
    }

    const saved = await res.json() as EodRow
    setSuccess(true)
    onSaved(saved)
  }

  if (success && !isEdit) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
        <p className="font-semibold text-green-800 text-lg">EOD submitted successfully</p>
        <p className="text-sm text-green-700">{fmtDate(date)} · {locale} · {workflow}</p>
        <p className="text-xs text-green-600 italic">You can edit this until 17:30 Madrid time.</p>
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 disabled:opacity-50 bg-white disabled:cursor-not-allowed'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── User Info ─────────────────────────────────────────── */}
      <SectionCard>
        <FieldLabel label="1. Name" />
        <p className="text-sm font-medium text-slate-800">{session.name}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">From your account</p>
      </SectionCard>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard>
          <FieldLabel label="2. Locale" required />
          <select value={locale} onChange={e => setLocale(e.target.value)}
            disabled={disabled} className={inputCls}>
            {LOCALES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </SectionCard>
        <SectionCard>
          <FieldLabel label="3. Date" required />
          <input type="date" value={date} max={todayISO()}
            onChange={e => setDate(e.target.value)}
            disabled={disabled} required className={inputCls} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard>
          <FieldLabel label="4. Workflow" required />
          <select value={workflow} onChange={e => setWorkflow(e.target.value)}
            disabled={disabled} className={inputCls}>
            {WORKFLOWS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </SectionCard>
        <SectionCard>
          <FieldLabel label="5. Workset" hint="Name or ID of the workset" required />
          <input type="text" value={workset} placeholder="e.g. nl-nl_dmo_batch-a_hop"
            onChange={e => setWorkset(e.target.value)}
            disabled={disabled} required className={inputCls} />
        </SectionCard>
      </div>

      {/* ── Production Metrics ────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Production Metrics</p>

        <div>
          <FieldLabel label="6. Number of Reports" hint="Total annotation reports completed" />
          <NumInput value={numReports} onChange={setNumReports} step={1} integer disabled={disabled} />
        </div>
        <div>
          <FieldLabel label="7. Minutes of Completed Units" hint="Total audio/content minutes of completed units" />
          <NumInput value={minutesCompleted} onChange={setMinutesCompleted} step={0.5} disabled={disabled} />
        </div>
        <div>
          <FieldLabel label="8. Minutes Transcribed" hint="Total audio minutes transcribed" />
          <NumInput value={minutesTranscribed} onChange={setMinutesTranscribed} step={0.5} disabled={disabled} />
        </div>
      </div>

      {/* ── Other Working Hours ───────────────────────────────── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Other Working Hours</p>

        <div>
          <FieldLabel label="9. Review & Rework of Previous Sets"
            hint="PHI Review, 2Pass Review, end-of-workset review, etc." />
          <NumInput value={owReviewRework} onChange={setOwReviewRework} step={0.5} disabled={disabled} />
        </div>
        <div>
          <FieldLabel label="10. IT Issues (Non-NEAT) / Training"
            hint="Non-NEAT IT issues and training hours" />
          <NumInput value={owItTraining} onChange={setOwItTraining} step={0.5} disabled={disabled} />
        </div>
        <div>
          <FieldLabel label="11. NEAT Issues & NEAT Testing" />
          <NumInput value={owNeat} onChange={setOwNeat} step={0.5} disabled={disabled} />
        </div>
        <div>
          <FieldLabel label="12. Waiting for a Workset" />
          <NumInput value={owWaiting} onChange={setOwWaiting} step={0.5} disabled={disabled} />
        </div>

        <div className="text-xs text-amber-700 font-medium pt-1 border-t border-amber-200">
          Total Other Working Hours: <span className="font-bold">{totalOW} h</span>
        </div>
      </div>

      {/* ── Production Hours ──────────────────────────────────── */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Production Hours</p>

        <div>
          <FieldLabel label="13. Transcribing & Scribing Production Hours" />
          <NumInput value={phTranscribing} onChange={setPhTranscribing} step={0.5} disabled={disabled} />
        </div>
        <div>
          <FieldLabel label="14. IAA Working Hours" />
          <NumInput value={phIaa} onChange={setPhIaa} step={0.5} disabled={disabled} />
        </div>
        <div>
          <FieldLabel label="15. PHI Production Hours" />
          <NumInput value={phPhi} onChange={setPhPhi} step={0.5} disabled={disabled} />
        </div>

        <div className="text-xs text-green-700 font-medium pt-1 border-t border-green-200">
          Total Production Hours: <span className="font-bold">{totalPH} h</span>
        </div>
      </div>

      {/* ── Total ─────────────────────────────────────────────── */}
      <SectionCard>
        <FieldLabel label="16. Total Working Hours" hint="Auto-calculated" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-slate-800 tabular-nums">
            {totalHours % 1 === 0 ? `${totalHours}.0` : totalHours}
          </span>
          <span className="text-base text-slate-500">h total</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.min((totalHours / 8) * 100, 100)}%` }} />
        </div>
      </SectionCard>

      {/* ── Remarks ───────────────────────────────────────────── */}
      <SectionCard>
        <FieldLabel
          label="17. Remarks"
          hint="Additional information about blockers, notes or context for today's working day. Do not indicate minutes or time here."
          required
        />
        <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
          rows={3} disabled={disabled}
          placeholder="e.g. Workset delayed due to audio quality issues, waiting for PM confirmation on batch…"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 placeholder:text-slate-300 resize-none disabled:opacity-50" />
      </SectionCard>

      {error && (
        <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!readOnly && !locked && (
        <button type="submit" disabled={submitting}
          className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Submitting…' : isEdit ? 'Save changes' : 'Submit EOD'}
        </button>
      )}

      {locked && (
        <div className="flex items-center gap-2 justify-center py-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-medium">
          <Lock className="w-4 h-4" />
          Submissions locked after 17:30 Madrid time
        </div>
      )}

      {readOnly && (
        <div className="flex items-center gap-2 justify-center py-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-medium">
          <Lock className="w-4 h-4" />
          View only — your role cannot submit EOD forms
        </div>
      )}
    </form>
  )
}

// ─── SubmitPage ───────────────────────────────────────────────────────────────

export default function EodPage() {
  const router = useRouter()
  const [user,        setUser]        = useState<SessionUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [existing,    setExisting]    = useState<EodRow | null>(null)
  const [isEditing,   setIsEditing]   = useState(false)
  const notifFired    = useRef(false)

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        if (!res.ok) return null
        return res.json()
      })
      .then((data: { user: SessionUser } | null) => {
        if (!data) return
        setUser(data.user)
      })
      .catch(() => router.push('/login'))
      .finally(() => setAuthLoading(false))
  }, [router])

  // ── Load today's existing submission ──────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const today = new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }).split(',')[0]
    const [m, d, y] = today.split('/')
    const dateStr = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
    fetch(`/api/eod?mine=true&date=${dateStr}`)
      .then(r => r.json())
      .then((data: EodRow | null) => { if (data) setExisting(data) })
      .catch(() => null)
  }, [user])

  // ── 4:30 PM reminder banner trigger ──────────────────────────────────────
  useEffect(() => {
    if (notifFired.current) return
    const minsToWarning = minutesUntil(16, 30)
    if (minsToWarning <= 0) return  // already past warning time
    const id = setTimeout(() => {
      notifFired.current = true
      // Force a re-render to show the DeadlineBanner
      setUser(u => u ? { ...u } : u)
    }, minsToWarning * 60_000)
    return () => clearTimeout(id)
  }, [user])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!user) return null

  const isViewer = user.role === 'viewer'
  const canEdit  = !isViewer && !isPastEditLock()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center">
            <ClipboardCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-800 text-sm">Dr. Strange Portal</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-slate-500">
              {user.name}
              {(user.role === 'admin' || user.role === 'pm') && (
                <span className="ml-1.5 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold capitalize">
                  {user.role}
                </span>
              )}
            </span>
          )}
          <button type="button" onClick={() => void handleLogout()}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">End of Day Form</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Daily client report — submit before <strong>5 PM Madrid time</strong>
          </p>
        </div>

        {/* Deadline banner */}
        <DeadlineBanner />

        {/* Already submitted today — show summary card + edit toggle */}
        {existing && !isEditing && (
          <div className="bg-white rounded-xl border border-green-200 shadow-sm p-5 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-sm font-semibold text-slate-800">EOD submitted for today</p>
              </div>
              {canEdit && (
                <button type="button" onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
              {!canEdit && !isViewer && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div><span className="text-slate-400">Locale</span><br /><strong>{existing.locale}</strong></div>
              <div><span className="text-slate-400">Workflow</span><br /><strong>{existing.workflow}</strong></div>
              <div className="col-span-2"><span className="text-slate-400">Workset</span><br /><strong>{existing.workset}</strong></div>
              <div><span className="text-slate-400">Reports</span><br /><strong>{existing.numReports}</strong></div>
              <div><span className="text-slate-400">Min completed</span><br /><strong>{existing.minutesCompleted}</strong></div>
              <div><span className="text-slate-400">Min transcribed</span><br /><strong>{existing.minutesTranscribed}</strong></div>
              <div><span className="text-slate-400">OW hours</span><br /><strong>{round1(existing.owReviewRework + existing.owItTraining + existing.owNeat + existing.owWaiting)} h</strong></div>
              <div><span className="text-slate-400">Production hours</span><br /><strong>{round1(existing.phTranscribing + existing.phIaa + existing.phPhi)} h</strong></div>
            </div>
            {existing.remarks && (
              <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2">"{existing.remarks}"</p>
            )}
            <p className="text-[10px] text-slate-400">
              Submitted {new Date(existing.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} Madrid time
            </p>
          </div>
        )}

        {/* Form — shown on first submit or when editing */}
        {(!existing || isEditing) && (
          <EodForm
            session={user}
            existing={isEditing ? existing : null}
            readOnly={isViewer}
            onSaved={row => {
              setExisting(row)
              setIsEditing(false)
            }}
          />
        )}
      </main>
    </div>
  )
}

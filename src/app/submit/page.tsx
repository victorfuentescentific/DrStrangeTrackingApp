'use client'

import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, CheckCircle2, Minus, Plus, LogOut,
  ClipboardList, PenLine, Pencil, Trash2, X,
} from 'lucide-react'
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

const PHASE_COLORS: Record<Phase, string> = {
  '1P+IAA': 'bg-blue-100 text-blue-700',
  '2P':     'bg-orange-100 text-orange-700',
  'PHI':    'bg-green-100 text-green-700',
  'Review': 'bg-slate-100 text-slate-600',
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmissionRow {
  id: string
  userId: string
  userName: string
  userLocale: string | null
  date: string
  locale: string
  workflow: WorkflowType
  phase: Phase
  worksetId: string | null
  worksetName: string | null
  hours: number
  notes: string
  submittedAt: string
}

interface UserSummary {
  id: string
  name: string
  role: string
  locale: string | null
  employeeType: string | null
  workflow: string | null
}

interface SuccessData {
  date: string
  locale: string
  workflow: WorkflowType
  phase: Phase
  hours: number
  forName?: string
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
        <button type="button" onClick={decrement} disabled={value <= 0.5}
          className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-4xl font-bold text-slate-800 tabular-nums w-20 text-center">
          {value % 1 === 0 ? `${value}.0` : value}
          <span className="text-base font-normal text-slate-500 ml-1">h</span>
        </span>
        <button type="button" onClick={increment} disabled={value >= 8}
          className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div key={i} className={cn('h-2 flex-1 rounded-full transition-colors', i < filled ? 'bg-brand-500' : 'bg-slate-200')} />
        ))}
      </div>
      <p className="text-xs text-slate-400">0.5 – 8 hours · use +/- to adjust</p>
    </div>
  )
}

// ─── SuccessCard ──────────────────────────────────────────────────────────────

function SuccessCard({ data, onAnother }: { data: SuccessData; onAnother: () => void }) {
  const phaseInfo = PHASES.find((p) => p.key === data.phase)!
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-4">
      <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
      <div>
        <p className="font-semibold text-green-800 text-lg">Hours logged successfully</p>
        {data.forName && (
          <p className="text-sm text-green-600 mt-0.5">Submitted for {data.forName}</p>
        )}
        <p className="text-sm text-green-700 mt-1">
          {data.date} · {data.locale} · {data.workflow} · {phaseInfo.label} · {data.hours}h
        </p>
      </div>
      <button type="button" onClick={onAnother}
        className="px-4 py-2 text-sm font-medium bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors">
        Submit another day
      </button>
    </div>
  )
}

// ─── HoursForm ────────────────────────────────────────────────────────────────

interface HoursFormProps {
  initialLocale: Locale
  /** When set (admin mode), submits on behalf of this user */
  forUser?: { id: string; name: string; locale: string | null }
}

function HoursForm({ initialLocale, forUser }: HoursFormProps) {
  const [date,       setDate]       = useState(todayISO())
  const [locale,     setLocale]     = useState<Locale>(initialLocale)
  const [workflow,   setWorkflow]   = useState<WorkflowType>('DAX')
  const [phase,      setPhase]      = useState<Phase>('1P+IAA')
  const [workset,    setWorkset]    = useState('')
  const [hours,      setHours]      = useState(4)
  const [notes,      setNotes]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState<SuccessData | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const body: Record<string, unknown> = {
      date, locale, workflow, phase,
      workset: workset.trim() || null,
      hours,
      notes: notes.trim() || null,
    }

    // Admin submitting for someone else — pass userId / userName in body
    if (forUser) {
      body.userId     = forUser.id
      body.userName   = forUser.name
      body.userLocale = forUser.locale
    }

    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSubmitting(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Submission failed. Please try again.')
      return
    }

    setSuccess({ date, locale, workflow, phase, hours, forName: forUser?.name })
  }

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

  if (success) return <SuccessCard data={success} onAnother={resetForm} />

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">

      {/* ── Date ── */}
      <div className="px-5 py-4 space-y-1.5">
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Work date</label>
        <input type="date" required value={date} max={todayISO()} onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800" />
      </div>

      {/* ── Locale ── */}
      <div className="px-5 py-4 space-y-1.5">
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Locale</label>
        <select value={locale} onChange={e => setLocale(e.target.value as Locale)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 bg-white">
          {LOCALES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* ── Workflow ── */}
      <div className="px-5 py-4 space-y-1.5">
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Workflow</label>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {WORKFLOWS.map(w => (
            <button key={w} type="button" onClick={() => setWorkflow(w)}
              className={cn('flex-1 py-2 text-sm font-medium transition-colors',
                workflow === w ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* ── Phase ── */}
      <div className="px-5 py-4 space-y-1.5">
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Phase</label>
        <div className="flex gap-2 flex-wrap">
          {PHASES.map(p => {
            const selected = phase === p.key
            return (
              <button key={p.key} type="button" onClick={() => setPhase(p.key)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                  selected
                    ? cn(p.bg, p.text, 'border-transparent ring-2', p.ring)
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
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
        <input type="text" value={workset} onChange={e => setWorkset(e.target.value)}
          placeholder="e.g. nl-nl_dmo_batch-a_hop"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 placeholder:text-slate-300" />
      </div>

      {/* ── Hours worked ── */}
      <div className="px-5 py-4 space-y-1.5">
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Hours worked</label>
        <HoursInput value={hours} onChange={setHours} />
      </div>

      {/* ── Notes (optional) ── */}
      <div className="px-5 py-4 space-y-1.5">
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
          Notes <span className="normal-case font-normal text-slate-400">(optional)</span>
        </label>
        <textarea value={notes} onChange={e => setNotes(e.target.value.slice(0, 200))}
          placeholder="Any notes about your session…" rows={3}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 placeholder:text-slate-300 resize-none" />
        <p className="text-xs text-slate-400 text-right">{notes.length}/200</p>
      </div>

      {error && (
        <div className="px-5 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* ── Submit ── */}
      <div className="px-5 py-4">
        <button type="submit" disabled={submitting}
          className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Submitting…' : forUser ? `Submit hours for ${forUser.name}` : 'Submit hours'}
        </button>
      </div>
    </form>
  )
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({ sub, onSaved, onClose }: { sub: SubmissionRow; onSaved: () => void; onClose: () => void }) {
  const [date,       setDate]       = useState(sub.date)
  const [locale,     setLocale]     = useState<Locale>(sub.locale as Locale)
  const [workflow,   setWorkflow]   = useState<WorkflowType>(sub.workflow)
  const [phase,      setPhase]      = useState<Phase>(sub.phase)
  const [hours,      setHours]      = useState(sub.hours)
  const [notes,      setNotes]      = useState(sub.notes)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch(`/api/submissions?id=${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, locale, workflow, phase, hours, notes }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to save')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Edit submission</h2>
            <p className="text-xs text-slate-400 mt-0.5">{sub.userName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Work date</label>
            <input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          {/* Locale */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Locale</label>
            <select value={locale} onChange={e => setLocale(e.target.value as Locale)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
              {LOCALES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Workflow */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Workflow</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {WORKFLOWS.map(w => (
                <button key={w} type="button" onClick={() => setWorkflow(w)}
                  className={cn('flex-1 py-2 text-sm font-medium transition-colors',
                    workflow === w ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Phase */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Phase</label>
            <div className="flex gap-2 flex-wrap">
              {PHASES.map(p => {
                const sel = phase === p.key
                return (
                  <button key={p.key} type="button" onClick={() => setPhase(p.key)}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                      sel ? cn(p.bg, p.text, 'border-transparent ring-2', p.ring) : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
                    <span className={cn('w-2 h-2 rounded-full', p.dot)} />
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Hours */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Hours worked</label>
            <HoursInput value={hours} onChange={setHours} />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              Notes <span className="normal-case font-normal text-slate-400">(optional)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value.slice(0, 200))} rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-brand-500 text-white rounded-lg py-2 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── SubmissionsPanel (admin tab 2) ───────────────────────────────────────────

function SubmissionsPanel() {
  const [from,      setFrom]      = useState(daysAgo(7))
  const [to,        setTo]        = useState(todayISO())
  const [subs,      setSubs]      = useState<SubmissionRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [editSub,   setEditSub]   = useState<SubmissionRow | null>(null)
  const [deleteSub, setDeleteSub] = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState(false)

  const fetchSubs = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/submissions?from=${from}&to=${to}`)
    const data = await res.json()
    setSubs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [from, to])

  useEffect(() => { fetchSubs() }, [fetchSubs])

  async function handleDelete(id: string) {
    setDeleting(true)
    await fetch(`/api/submissions?id=${id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteSub(null)
    fetchSubs()
  }

  const totalHours = subs.reduce((sum, s) => sum + s.hours, 0)

  return (
    <div className="space-y-4">
      {/* Date range filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button onClick={fetchSubs}
            className="px-4 py-1.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors">
            Apply
          </button>
        </div>
      </div>

      {/* Summary */}
      {!loading && (
        <p className="text-xs text-slate-500">
          {subs.length} submission{subs.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)}h total
        </p>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Locale</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Workflow</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Phase</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hours</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : subs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">No submissions in this range</td>
                </tr>
              ) : subs.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{s.userName}</p>
                    {s.userLocale && <p className="text-[11px] text-slate-400">{s.userLocale}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{fmtDate(s.date)}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{s.locale}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">{s.workflow}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', PHASE_COLORS[s.phase])}>{s.phase}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{s.hours}h</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate text-xs">{s.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditSub(s)} title="Edit"
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteSub(s.id)} title="Delete"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editSub && (
        <EditModal sub={editSub} onSaved={() => { setEditSub(null); fetchSubs() }} onClose={() => setEditSub(null)} />
      )}

      {/* Delete confirm */}
      {deleteSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Delete submission?</h3>
            <p className="text-sm text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteSub)} disabled={deleting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => setDeleteSub(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AdminView ────────────────────────────────────────────────────────────────

function AdminView() {
  const [activeTab, setActiveTab] = useState<'form' | 'submissions'>('form')
  const [users,     setUsers]     = useState<UserSummary[]>([])
  const [forUserId, setForUserId] = useState('')

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then((data: UserSummary[]) => {
        if (!Array.isArray(data)) return
        // Admin can submit for any freelancer
        const freelancers = data.filter(u => u.role === 'freelancer' || u.employeeType === 'FREELANCER')
        setUsers(freelancers)
        if (freelancers.length > 0) setForUserId(freelancers[0].id)
      })
  }, [])

  const selectedUser = users.find(u => u.id === forUserId)
  const forUser = selectedUser
    ? { id: selectedUser.id, name: selectedUser.name, locale: selectedUser.locale }
    : undefined

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('form')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'form'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          <PenLine className="w-4 h-4" />
          Form
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'submissions'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          <ClipboardList className="w-4 h-4" />
          Submissions
        </button>
      </div>

      {activeTab === 'form' ? (
        <div className="space-y-4">
          {/* User selector */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
              Submit for
            </label>
            {users.length === 0 ? (
              <p className="text-sm text-amber-600">Loading freelancers…</p>
            ) : (
              <select value={forUserId} onChange={e => setForUserId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-slate-800">
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.locale ? ` (${u.locale})` : ''}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-amber-600 mt-1.5">You are submitting hours on behalf of this freelancer</p>
          </div>

          {/* Submission form — remounts when selected user changes, inheriting their locale */}
          {forUser && (
            <HoursForm
              key={forUser.id}
              initialLocale={(forUser.locale as Locale | null) ?? 'en_GB'}
              forUser={forUser}
            />
          )}
        </div>
      ) : (
        <SubmissionsPanel />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubmitPage() {
  const router = useRouter()
  const [user,        setUser]        = useState<SessionUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        if (!res.ok) return null
        return res.json()
      })
      .then(data => {
        if (!data) return
        const u: SessionUser = data.user
        // Only freelancers and admins may access this page
        if (u.role !== 'freelancer' && u.role !== 'admin') {
          router.push('/')
          return
        }
        setUser(u)
      })
      .catch(() => router.push('/login'))
      .finally(() => setAuthLoading(false))
  }, [router])

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

  const isAdmin    = user.role === 'admin'
  const userLocale = user.locale && (LOCALES as readonly string[]).includes(user.locale)
    ? user.locale as Locale
    : 'en_GB'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">DS</span>
          </div>
          <span className="font-semibold text-slate-800 text-sm">Dr. Strange Portal</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-slate-500">
              {user.name}
              {isAdmin && (
                <span className="ml-1.5 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold">
                  Admin
                </span>
              )}
            </span>
          )}
          <button type="button" onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className={cn('mx-auto px-4 py-8', isAdmin ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">
            {isAdmin ? 'Hours Submissions' : 'Log your hours'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin ? 'Submit and manage freelancer daily hour logs' : 'Record your daily work session'}
          </p>
        </div>

        {isAdmin ? (
          <AdminView />
        ) : (
          <HoursForm initialLocale={userLocale} />
        )}
      </main>
    </div>
  )
}

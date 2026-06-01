'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useStore } from '@/lib/store'
import { ROLE_PERMISSIONS } from '@/lib/types'
import {
  CheckCircle2, XCircle, Clock, Users, ChevronLeft, ChevronRight,
  Pencil, Trash2, X, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EodRow {
  id: string
  userId: string
  userName: string
  userLocale: string | null
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

interface UserSummary { id: string; name: string; locale: string | null; role: string }

function round1(v: number) { return Math.round(v * 10) / 10 }

// ─── Date navigation helpers ──────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({ sub, onSaved, onClose }: {
  sub: EodRow
  onSaved: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({ ...sub })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set<K extends keyof EodRow>(k: K, v: EodRow[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch(`/api/eod?id=${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale: form.locale, workflow: form.workflow, workset: form.workset,
        numReports: form.numReports, minutesCompleted: form.minutesCompleted,
        minutesTranscribed: form.minutesTranscribed,
        owReviewRework: form.owReviewRework, owItTraining: form.owItTraining,
        owNeat: form.owNeat, owWaiting: form.owWaiting,
        phTranscribing: form.phTranscribing, phIaa: form.phIaa, phPhi: form.phPhi,
        remarks: form.remarks,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? 'Failed to save')
      return
    }
    onSaved()
  }

  const inp = 'w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500'
  const num = (label: string, k: keyof EodRow, step = 0.5) => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type="number" min={0} step={step} value={form[k] as number}
        onChange={e => set(k, parseFloat(e.target.value) as EodRow[typeof k])}
        className={inp} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Edit EOD — {sub.userName}</h2>
            <p className="text-xs text-slate-400">{fmtDate(sub.date)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={save} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Workflow</label>
              <select value={form.workflow} onChange={e => set('workflow', e.target.value)} className={inp}>
                {['DAX','DMO','Scribing'].map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Workset</label>
              <input type="text" value={form.workset}
                onChange={e => set('workset', e.target.value)} className={inp} />
            </div>
          </div>

          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide pt-1">Production metrics</p>
          <div className="grid grid-cols-3 gap-3">
            {num('Reports',         'numReports',         1)}
            {num('Min completed',   'minutesCompleted',   0.5)}
            {num('Min transcribed', 'minutesTranscribed', 0.5)}
          </div>

          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide pt-1">Other Working Hours</p>
          <div className="grid grid-cols-2 gap-3">
            {num('Review & Rework', 'owReviewRework')}
            {num('IT / Training',   'owItTraining')}
            {num('NEAT',            'owNeat')}
            {num('Waiting',         'owWaiting')}
          </div>

          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide pt-1">Production Hours</p>
          <div className="grid grid-cols-3 gap-3">
            {num('Transcribing', 'phTranscribing')}
            {num('IAA',          'phIaa')}
            {num('PHI',          'phPhi')}
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Remarks</label>
            <textarea value={form.remarks} onChange={e => set('remarks', e.target.value)}
              rows={2} className={inp + ' resize-none'} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-brand-500 text-white rounded-lg py-2 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminEodPage() {
  const { currentUser, worksets } = useStore()
  const perms   = ROLE_PERMISSIONS[currentUser.role]
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'pm'
  const isLead  = currentUser.role === 'lead'

  const [date,       setDate]       = useState(todayISO())
  const [subs,       setSubs]       = useState<EodRow[]>([])
  const [users,      setUsers]      = useState<UserSummary[]>([])
  const [loading,    setLoading]    = useState(false)
  const [editSub,    setEditSub]    = useState<EodRow | null>(null)
  const [deleteSub,  setDeleteSub]  = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState(false)

  // Fetch users for "who hasn't submitted" panel (admin/pm only)
  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then((data: UserSummary[]) => setUsers(
        data.filter(u => u.role !== 'viewer' && u.role !== 'admin' && u.role !== 'pm'),
      ))
      .catch(() => null)
  }, [isAdmin])

  const fetchSubs = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/eod?date=${date}`)
    const data = await res.json() as EodRow[]
    setSubs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [date])

  useEffect(() => { void fetchSubs() }, [fetchSubs])

  async function handleDelete(id: string) {
    setDeleting(true)
    await fetch(`/api/eod?id=${id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteSub(null)
    void fetchSubs()
  }

  // Who hasn't submitted (admin/PM only)
  const submittedUserIds = new Set(subs.map(s => s.userId))
  const missing = users.filter(u => !submittedUserIds.has(u.id))

  const totalOW  = (s: EodRow) => round1(s.owReviewRework + s.owItTraining + s.owNeat + s.owWaiting)
  const totalPH  = (s: EodRow) => round1(s.phTranscribing + s.phIaa + s.phPhi)
  const totalAll = (s: EodRow) => round1(totalOW(s) + totalPH(s))

  if (!isAdmin && !isLead) {
    return (
      <AppLayout title="EOD Dashboard" subtitle="End of Day submissions">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-700 font-medium">Access restricted</p>
          <p className="text-red-500 text-sm mt-1">Admin, PM or Lead role required</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="EOD Dashboard" subtitle="End of Day submissions — daily client report">
      <div className="space-y-6">

        {/* ── Date navigation ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button onClick={() => setDate(d => addDays(d, -1))}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <input type="date" value={date} max={todayISO()}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <button onClick={() => setDate(d => addDays(d, 1))}
            disabled={date >= todayISO()}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-sm text-slate-500">{fmtDate(date)}</span>
          {date !== todayISO() && (
            <button onClick={() => setDate(todayISO())}
              className="text-xs text-brand-600 hover:underline font-medium">
              Today
            </button>
          )}
        </div>

        {/* ── Status summary (admin/PM only) ─────────────────────────────────── */}
        {isAdmin && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{subs.length}</p>
                <p className="text-xs text-slate-500">Submitted</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{missing.length}</p>
                <p className="text-xs text-slate-500">Missing</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{users.length}</p>
                <p className="text-xs text-slate-500">Total staff</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Who hasn't submitted (admin/PM only) ───────────────────────────── */}
        {isAdmin && missing.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Not yet submitted
            </p>
            <div className="flex flex-wrap gap-2">
              {missing.map(u => (
                <span key={u.id}
                  className="text-xs px-2.5 py-1 bg-white border border-red-200 rounded-full text-red-700 font-medium">
                  {u.name}{u.locale ? ` · ${u.locale}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Submissions table ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              EOD Submissions{subs.length > 0 ? ` (${subs.length})` : ''}
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="w-3 h-3" />
              {loading ? 'Loading…' : 'Live'}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
              <Clock className="w-4 h-4 animate-pulse" /> Loading…
            </div>
          ) : subs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
              <XCircle className="w-8 h-8 text-slate-200" />
              <p className="text-slate-400 text-sm">No EOD submissions for {fmtDate(date)}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Locale</th>
                    <th className="px-4 py-3">Workflow</th>
                    <th className="px-4 py-3">Workset</th>
                    <th className="px-4 py-3 text-right">Reports</th>
                    <th className="px-4 py-3 text-right">Min done</th>
                    <th className="px-4 py-3 text-right">Min trans</th>
                    <th className="px-4 py-3 text-right">OW h</th>
                    <th className="px-4 py-3 text-right">PH h</th>
                    <th className="px-4 py-3 text-right">Total h</th>
                    <th className="px-4 py-3 text-right">Time</th>
                    {isAdmin && <th className="px-4 py-3 w-16" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subs.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{s.userName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.locale}</td>
                      <td className="px-4 py-3 text-slate-600">{s.workflow}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate" title={s.workset}>{s.workset}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{s.numReports}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{s.minutesCompleted}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{s.minutesTranscribed}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700 font-medium">{totalOW(s)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700 font-medium">{totalPH(s)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-800">{totalAll(s)}</td>
                      <td className="px-4 py-3 text-right text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(s.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setEditSub(s)}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteSub(s.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">{subs.length} submission{subs.length !== 1 ? 's' : ''} for {fmtDate(date)}</p>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editSub && (
        <EditModal sub={editSub} onClose={() => setEditSub(null)} onSaved={() => { setEditSub(null); void fetchSubs() }} />
      )}

      {/* Delete confirm */}
      {deleteSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="font-semibold text-slate-800">Delete this EOD submission?</p>
            <p className="text-sm text-slate-500">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => void handleDelete(deleteSub)} disabled={deleting}
                className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => setDeleteSub(null)}
                className="flex-1 border border-slate-200 rounded-lg py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

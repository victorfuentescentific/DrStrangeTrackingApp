'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { StatusBadge } from '@/components/availability/StatusBadge'
import { type AvailabilitySubmission, type AvailabilityStatus, STATUS_CONFIG } from '@/lib/availability-types'
import { type UserSummary } from '@/app/api/users/route'
import { Pencil, Trash2, Plus, Flag, X, ChevronLeft, ChevronRight } from 'lucide-react'

// ── Inline edit/create modal ──────────────────────────────────────────────────

const VALID_STATUSES: AvailabilityStatus[] = [
  'AVAILABLE','PTO','BH','NO','SL','WA','UL','DH','PATERNITY','OTHER',
]
const VALID_HOURS = [0, 2, 4, 6, 8, 10, 12]
const START_TIMES = [
  '07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00',
]
const FTE_ONLY_STATUSES: AvailabilityStatus[] = ['PTO','UL','DH','PATERNITY','OTHER']

interface ModalProps {
  users: UserSummary[]
  existing: AvailabilitySubmission | null  // null = new submission
  onSaved: () => void
  onClose: () => void
}

function SubmissionModal({ users, existing, onSaved, onClose }: ModalProps) {
  const [userId, setUserId]         = useState(existing?.userId ?? '')
  const [date, setDate]             = useState(existing?.date ?? new Date().toISOString().slice(0, 10))
  const [status, setStatus]         = useState<AvailabilityStatus>(existing?.status ?? 'AVAILABLE')
  const [hours, setHours]           = useState<number>(existing?.availabilityHours ?? 8)
  const [startTime, setStartTime]   = useState(existing?.estimatedStartCet?.slice(0, 5) ?? '09:00')
  const [notes, setNotes]           = useState(existing?.notes ?? '')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const selectedUser = users.find(u => u.id === userId)
  const isFreelancer = selectedUser?.employeeType === 'FREELANCER' || selectedUser?.role === 'freelancer'
  const availableStatuses = VALID_STATUSES.filter(s => !isFreelancer || !FTE_ONLY_STATUSES.includes(s))
  const needsHours     = status === 'AVAILABLE' || status === 'WA'
  const needsStartTime = needsHours && hours > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) { setError('Please select a user'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          date,
          status,
          availabilityHours: needsHours ? hours : null,
          estimatedStartCet: needsStartTime ? startTime : null,
          locale:   selectedUser?.locale   ?? null,
          workflow: selectedUser?.workflow  ?? null,
          notes,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.details?.join(', ') ?? data.error ?? 'Failed to save')
        return
      }
      onSaved()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {existing ? 'Edit submission' : 'New submission'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
            <select
              value={userId}
              onChange={e => setUserId(e.target.value)}
              disabled={!!existing}
              className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">Select a user…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.locale ? `(${u.locale})` : '(Management)'}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              disabled={!!existing}
              className="block w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex flex-wrap gap-2">
              {availableStatuses.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    status === s
                      ? 'border-blue-500 ring-2 ring-blue-300 ' + STATUS_CONFIG[s].color
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Hours */}
          {needsHours && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
              <div className="flex gap-2">
                {VALID_HOURS.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    className={`w-10 h-10 rounded-lg text-sm font-semibold border transition-all ${
                      hours === h
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start time */}
          {needsStartTime && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start time (CET)</label>
              <select
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="block w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {START_TIMES.map(t => <option key={t} value={t}>{t} CET</option>)}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : existing ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LOCALES  = ['nl_NL','de_DE','fr_FR','en_GB','da_DK','nb_NO','fi_FI','sv_SE']
const STATUSES = ['AVAILABLE','PTO','BH','NO','SL','WA','UL','DH','PATERNITY','OTHER']

function getDefaultRange() {
  const now  = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

export default function AdminSubmissionsPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [users,  setUsers]  = useState<UserSummary[]>([])

  const def = getDefaultRange()
  const [from,           setFrom]           = useState(def.from)
  const [to,             setTo]             = useState(def.to)
  const [filterLocale,   setFilterLocale]   = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterFlagged,  setFilterFlagged]  = useState(false)
  const [filterUser,     setFilterUser]     = useState('')

  const [submissions, setSubmissions] = useState<AvailabilitySubmission[]>([])
  const [loading,     setLoading]     = useState(false)
  const [page,        setPage]        = useState(0)
  const PAGE_SIZE = 50

  const [modalOpen,    setModalOpen]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<AvailabilitySubmission | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  // Auth check
  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.status === 401) { router.push('/login'); return }
      return r.json()
    }).then(data => {
      if (data?.user?.role !== 'admin') { router.push('/'); return }
      setAuthed(true)
      fetch('/api/users').then(r => r.json()).then((us: UserSummary[]) => {
        if (Array.isArray(us)) setUsers(us)
      })
    })
  }, [router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ from, to })
    if (filterLocale) params.set('locale', filterLocale)
    const res  = await fetch(`/api/availability?${params}`)
    const data = await res.json()
    setSubmissions(Array.isArray(data) ? data : [])
    setPage(0)
    setLoading(false)
  }, [from, to, filterLocale])

  useEffect(() => {
    if (!authed) return
    fetchData()
  }, [authed, fetchData])

  // Client-side filters (status, flagged, user search)
  const userById = Object.fromEntries(users.map(u => [u.id, u]))
  const filtered = submissions.filter(s => {
    if (filterStatus  && s.status !== filterStatus) return false
    if (filterFlagged && !s.flaggedForReview)       return false
    if (filterUser) {
      const name = userById[s.userId]?.name ?? s.userId
      if (!name.toLowerCase().includes(filterUser.toLowerCase())) return false
    }
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  async function handleDelete(id: string) {
    setDeleting(true)
    await fetch(`/api/availability?id=${id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteTarget(null)
    fetchData()
  }

  function openNew()  { setEditTarget(null); setModalOpen(true) }
  function openEdit(s: AvailabilitySubmission) { setEditTarget(s); setModalOpen(true) }

  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
  }

  if (!authed) return null

  return (
    <AppLayout title="Submissions" subtitle="Admin — view and edit all availability submissions">
      <div className="px-4 py-8 space-y-5">

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-end">

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Locale</label>
              <select value={filterLocale} onChange={e => setFilterLocale(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All</option>
                {LOCALES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All</option>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">User</label>
              <input
                type="text"
                placeholder="Search name…"
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pb-1">
              <input type="checkbox" checked={filterFlagged} onChange={e => setFilterFlagged(e.target.checked)}
                className="rounded" />
              <span className="text-sm text-gray-700">Flagged only</span>
            </label>

            <button
              onClick={fetchData}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>

            <div className="ml-auto">
              <button
                onClick={openNew}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> New submission
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary ── */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{filtered.length} submissions</span>
          {filtered.filter(s => s.flaggedForReview).length > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <Flag className="w-3.5 h-3.5" />
              {filtered.filter(s => s.flaggedForReview).length} flagged
            </span>
          )}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500">Status</th>
                <th className="text-center px-3 py-3 font-medium text-gray-500">Hours</th>
                <th className="text-center px-3 py-3 font-medium text-gray-500">Start</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500">Notes</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500">Locale</th>
                <th className="text-center px-3 py-3 font-medium text-gray-500 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading…</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No submissions found</td></tr>
              ) : paged.map(s => {
                const u = userById[s.userId]
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 ${s.flaggedForReview ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u?.name ?? s.userId}</p>
                      <p className="text-xs text-gray-400">{u?.employeeType ?? '—'}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-700">{fmtDate(s.date)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={s.status} employeeType={u?.employeeType} hours={null} size="sm" />
                    </td>
                    <td className="px-3 py-3 text-center text-gray-700">
                      {s.availabilityHours ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-500 text-xs">
                      {s.estimatedStartCet?.slice(0, 5) ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-500 max-w-[200px] truncate">
                      {s.flaggedForReview && (
                        <span className="inline-flex items-center gap-1 text-amber-600 mr-1">
                          <Flag className="w-3 h-3" />
                        </span>
                      )}
                      {s.flagReason || s.notes || '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{s.locale ?? '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit / New modal ── */}
      {modalOpen && (
        <SubmissionModal
          users={users}
          existing={editTarget}
          onSaved={() => { setModalOpen(false); fetchData() }}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete submission?</h3>
            <p className="text-sm text-gray-500 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { StatusBadge } from '@/components/availability/StatusBadge'
import { type AvailabilitySubmission, type AvailabilityStatus, STATUS_CONFIG } from '@/lib/availability-types'
import { type UserSummary } from '@/app/api/users/route'
import { ChevronLeft, ChevronRight, Pencil, CheckSquare, X, Check } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type AppRole = 'admin' | 'lead' | 'fte' | 'freelancer'

interface SessionUser {
  id: string
  name: string
  role: AppRole
  locale: string | null
  employeeType: string | null
}

interface UserRow {
  userId: string
  userName: string
  employeeType: string | null
  locale: string | null
  workflow: string | null
  submissions: Record<string, AvailabilitySubmission>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_STATUSES: AvailabilityStatus[] = [
  'AVAILABLE','PTO','BH','NO','SL','WA','UL','DH','PATERNITY','OTHER',
]

function getWeekDates(offset = 0): string[] {
  const now = new Date()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

// ── Batch edit modal ──────────────────────────────────────────────────────────

interface BatchModalProps {
  dates: string[]
  selectedUserIds: string[]
  users: UserSummary[]
  onApplied: () => void
  onClose: () => void
}

function BatchModal({ dates, selectedUserIds, users, onApplied, onClose }: BatchModalProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>(dates)
  const [status, setStatus]               = useState<AvailabilityStatus>('AVAILABLE')
  const [hours, setHours]                 = useState<number | null>(8)
  const [saving, setSaving]               = useState(false)
  const [progress, setProgress]           = useState(0)

  const needsHours = status === 'AVAILABLE' || status === 'WA'
  const userById   = Object.fromEntries(users.map(u => [u.id, u]))

  function toggleDate(d: string) {
    setSelectedDates(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d])
  }

  async function apply() {
    if (!selectedDates.length || !selectedUserIds.length) return
    setSaving(true)
    const total = selectedUserIds.length * selectedDates.length
    let done = 0
    for (const userId of selectedUserIds) {
      const u = userById[userId]
      for (const date of selectedDates) {
        await fetch('/api/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            date,
            status,
            availabilityHours: needsHours ? hours : null,
            estimatedStartCet: null,
            locale:   u?.locale   ?? null,
            workflow: u?.workflow  ?? null,
            notes:    '',
          }),
        })
        done++
        setProgress(Math.round((done / total) * 100))
      }
    }
    setSaving(false)
    onApplied()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Batch edit</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Applying to <span className="font-semibold text-gray-800">{selectedUserIds.length} users</span>
        </p>

        {/* Date selection */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Dates</p>
          <div className="flex flex-wrap gap-2">
            {dates.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDate(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  selectedDates.includes(d)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {fmtDate(d)}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Status</p>
          <div className="flex flex-wrap gap-2">
            {VALID_STATUSES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  status === s
                    ? 'border-blue-500 ring-2 ring-blue-200 ' + STATUS_CONFIG[s].color
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
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Hours</p>
            <div className="flex gap-2">
              {[0, 2, 4, 6, 8, 10, 12].map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(h)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-all ${
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

        {saving && (
          <div className="mb-4">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{progress}% complete…</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={apply}
            disabled={saving || !selectedDates.length}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Applying…' : `Apply to ${selectedUserIds.length * selectedDates.length} cells`}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Cell edit modal ───────────────────────────────────────────────────────────

interface CellModalProps {
  userId: string
  userName: string
  date: string
  existing: AvailabilitySubmission | null
  user: UserSummary | undefined
  onSaved: () => void
  onClose: () => void
}

function CellModal({ userId, userName, date, existing, user, onSaved, onClose }: CellModalProps) {
  const [status, setStatus]       = useState<AvailabilityStatus>(existing?.status ?? 'AVAILABLE')
  const [hours, setHours]         = useState<number>(existing?.availabilityHours ?? 8)
  const [startTime, setStartTime] = useState(existing?.estimatedStartCet?.slice(0, 5) ?? '09:00')
  const [notes, setNotes]         = useState(existing?.notes ?? '')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const needsHours     = status === 'AVAILABLE' || status === 'WA'
  const needsStartTime = needsHours && hours > 0

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    const res = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        date,
        status,
        availabilityHours: needsHours ? hours : null,
        estimatedStartCet: needsStartTime ? startTime : null,
        locale:   user?.locale   ?? null,
        workflow: user?.workflow  ?? null,
        notes,
      }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.details?.join(', ') ?? d.error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">{userName}</p>
            <p className="text-xs text-gray-400">{fmtDate(date)}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {VALID_STATUSES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  status === s
                    ? 'border-blue-500 ring-2 ring-blue-200 ' + STATUS_CONFIG[s].color
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          {needsHours && (
            <div className="flex gap-1.5">
              {[0, 2, 4, 6, 8, 10, 12].map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(h)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-all ${
                    hours === h ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
          {needsStartTime && (
            <select
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="block w-36 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00'].map(t =>
                <option key={t} value={t}>{t} CET</option>
              )}
            </select>
          )}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes (optional)"
            className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {error && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
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

export default function OverviewPage() {
  const router = useRouter()
  const [me,      setMe]      = useState<SessionUser | null>(null)
  const [users,   setUsers]   = useState<UserSummary[]>([])
  const [submissions, setSubmissions] = useState<AvailabilitySubmission[]>([])
  const [loading, setLoading] = useState(false)
  const [weekOffset, setWeek] = useState(0)
  const [dates,   setDates]   = useState<string[]>(getWeekDates(0))

  // Admin-only controls
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [batchOpen,    setBatchOpen]    = useState(false)
  const [cellEdit,     setCellEdit]     = useState<{ userId: string; date: string } | null>(null)

  const isAdmin = me?.role === 'admin'

  // Auth + initial data load
  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.status === 401) { router.push('/login'); return null }
      return r.json()
    }).then(data => {
      if (!data) return
      const role: AppRole = data.user.role
      // Only admin, lead, fte, freelancer can access (all roles can, but freelancer sees own locale only)
      setMe(data.user)
      fetch('/api/users').then(r => r.json()).then((us: UserSummary[]) => {
        if (Array.isArray(us)) setUsers(us)
      })
    })
  }, [router])

  const fetchData = useCallback(async (ds: string[]) => {
    if (!me) return
    setLoading(true)
    const params = new URLSearchParams({ from: ds[0], to: ds[ds.length - 1] })
    // Scope non-admins to their locale
    if (me.role !== 'admin' && me.locale) params.set('locale', me.locale)
    const res  = await fetch(`/api/availability?${params}`)
    const data = await res.json()
    setSubmissions(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [me])

  useEffect(() => {
    if (!me) return
    const ds = getWeekDates(weekOffset)
    setDates(ds)
    fetchData(ds)
  }, [me, weekOffset, fetchData])

  const userById = Object.fromEntries(users.map(u => [u.id, u]))

  // ── Role-based filtering ──────────────────────────────────────────────────
  // admin  → all users
  // lead   → all employee types in their locale
  // fte    → only FTE users in their locale
  // freelancer → only FREELANCER users in their locale

  function isVisible(u: UserSummary): boolean {
    if (!me) return false
    if (me.role === 'admin') return true
    if (u.locale !== me.locale) return false
    if (me.role === 'lead')       return true
    if (me.role === 'fte')        return u.employeeType === 'FTE'
    if (me.role === 'freelancer') return u.employeeType === 'FREELANCER'
    return false
  }

  // Build row map from submissions, filtered by role
  const rowMap: Record<string, UserRow> = {}
  for (const s of submissions) {
    const u = userById[s.userId]
    if (u && !isVisible(u)) continue
    if (!rowMap[s.userId]) {
      rowMap[s.userId] = {
        userId:       s.userId,
        userName:     u?.name ?? s.userId,
        employeeType: u?.employeeType ?? null,
        locale:       u?.locale ?? null,
        workflow:     u?.workflow ?? null,
        submissions:  {},
      }
    }
    rowMap[s.userId].submissions[s.date] = s
  }

  // Group by locale → Management last, sorted alphabetically within group
  const groupMap: Record<string, UserRow[]> = {}
  for (const row of Object.values(rowMap)) {
    const key = row.locale ?? '__management__'
    if (!groupMap[key]) groupMap[key] = []
    groupMap[key].push(row)
  }
  for (const key of Object.keys(groupMap)) {
    groupMap[key].sort((a, b) => a.userName.localeCompare(b.userName))
  }
  const groupKeys = Object.keys(groupMap).filter(k => k !== '__management__').sort()
  if (groupMap['__management__']) groupKeys.push('__management__')

  const allVisibleIds = Object.values(rowMap).map(r => r.userId)
  const allSelected   = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id))

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(allVisibleIds))
  }

  const weekLabel = weekOffset === 0 ? 'This week'
    : weekOffset === -1 ? 'Last week'
    : weekOffset === 1  ? 'Next week'
    : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`

  const cellTarget = cellEdit
    ? { user: userById[cellEdit.userId], sub: rowMap[cellEdit.userId]?.submissions[cellEdit.date] ?? null }
    : null

  if (!me) return null

  return (
    <AppLayout title="Overview" subtitle="Team availability">
      <div className="px-4 py-8 space-y-5">

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setWeek(w => w - 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← Prev</button>
          <span className="text-sm font-semibold text-gray-700 min-w-[100px] text-center">{weekLabel}</span>
          <button onClick={() => setWeek(w => w + 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Next →</button>
          <button onClick={() => setWeek(0)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Today</button>

          {isAdmin && selectedIds.size > 0 && (
            <button
              onClick={() => setBatchOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors ml-auto"
            >
              <CheckSquare className="w-4 h-4" />
              Batch edit ({selectedIds.size})
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {isAdmin && (
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-48">User</th>
                {dates.map(d => (
                  <th key={d} className="text-center px-2 py-3 font-medium text-gray-500 min-w-[110px]">
                    {fmtDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-400">Loading…</td></tr>
              ) : groupKeys.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-400">No submissions for this period</td></tr>
              ) : groupKeys.map(key => (
                <>
                  {/* Group header */}
                  <tr key={`hdr-${key}`} className="bg-slate-50 border-y border-slate-200">
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={groupMap[key].every(r => selectedIds.has(r.userId))}
                          onChange={() => {
                            const ids = groupMap[key].map(r => r.userId)
                            const allIn = ids.every(id => selectedIds.has(id))
                            setSelectedIds(prev => {
                              const next = new Set(prev)
                              ids.forEach(id => allIn ? next.delete(id) : next.add(id))
                              return next
                            })
                          }}
                          className="rounded"
                        />
                      </td>
                    )}
                    <td colSpan={dates.length + 1} className="px-4 py-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                        {key === '__management__' ? 'Management' : key.replace('_', '-')}
                      </span>
                    </td>
                  </tr>

                  {/* User rows */}
                  {groupMap[key].map(row => (
                    <tr key={row.userId} className={`border-b border-gray-50 hover:bg-gray-50/50 ${selectedIds.has(row.userId) ? 'bg-blue-50/30' : ''}`}>
                      {isAdmin && (
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.userId)}
                            onChange={() => setSelectedIds(prev => {
                              const next = new Set(prev)
                              next.has(row.userId) ? next.delete(row.userId) : next.add(row.userId)
                              return next
                            })}
                            className="rounded"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{row.userName}</p>
                        {row.workflow && <p className="text-xs text-gray-400">{row.workflow}</p>}
                      </td>
                      {dates.map(d => {
                        const s = row.submissions[d]
                        return (
                          <td
                            key={d}
                            className={`px-2 py-3 text-center ${isAdmin ? 'cursor-pointer hover:bg-blue-50/50 group' : ''}`}
                            onClick={() => isAdmin && setCellEdit({ userId: row.userId, date: d })}
                          >
                            {s ? (
                              <div className="flex flex-col items-center gap-0.5 relative">
                                <StatusBadge status={s.status} employeeType={row.employeeType} hours={s.availabilityHours} size="sm" />
                                {s.estimatedStartCet && (
                                  <span className="text-[10px] text-gray-400">{s.estimatedStartCet.slice(0,5)}</span>
                                )}
                                {isAdmin && (
                                  <Pencil className="w-2.5 h-2.5 text-blue-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0 transition-opacity" />
                                )}
                              </div>
                            ) : (
                              <span className={`text-gray-200 ${isAdmin ? 'group-hover:text-blue-300' : ''}`}>—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Role info badge */}
        <p className="text-xs text-gray-400">
          Viewing as <span className="font-medium text-gray-600">{me.role}</span>
          {me.locale && <> · <span className="font-medium text-gray-600">{me.locale}</span></>}
          {isAdmin && <span className="ml-2 text-blue-500">Click any cell to edit · Select rows for batch edit</span>}
        </p>
      </div>

      {/* Batch edit modal */}
      {batchOpen && (
        <BatchModal
          dates={dates}
          selectedUserIds={[...selectedIds]}
          users={users}
          onApplied={() => { setBatchOpen(false); setSelectedIds(new Set()); fetchData(dates) }}
          onClose={() => setBatchOpen(false)}
        />
      )}

      {/* Cell edit modal */}
      {cellEdit && cellTarget && (
        <CellModal
          userId={cellEdit.userId}
          userName={rowMap[cellEdit.userId]?.userName ?? cellEdit.userId}
          date={cellEdit.date}
          existing={cellTarget.sub}
          user={cellTarget.user}
          onSaved={() => { setCellEdit(null); fetchData(dates) }}
          onClose={() => setCellEdit(null)}
        />
      )}
    </AppLayout>
  )
}

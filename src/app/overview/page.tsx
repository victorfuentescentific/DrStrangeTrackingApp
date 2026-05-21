'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { StatusBadge } from '@/components/availability/StatusBadge'
import { type AvailabilitySubmission, type AvailabilityStatus, STATUS_CONFIG } from '@/lib/availability-types'
import { type UserSummary } from '@/app/api/users/route'
import { Pencil, CheckSquare, X, ChevronDown } from 'lucide-react'

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
  userId:       string
  userName:     string
  role:         string | null
  employeeType: string | null
  locale:       string | null
  workflow:     string | null
  submissions:  Record<string, AvailabilitySubmission>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_STATUSES: AvailabilityStatus[] = [
  'AVAILABLE','PTO','BH','NO','SL','WA','UL','DH','PATERNITY','OTHER',
]
const VALID_HOURS = [0, 2, 4, 6, 8, 10, 12]
const EMPLOYEE_TYPES = ['FTE', 'FREELANCER', 'PM'] as const

// Leads sort first within any group, then FTEs, then freelancers
const ROLE_ORDER: Record<string, number> = { lead: 0, fte: 1, freelancer: 2, admin: 99 }

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function empTypeLabel(t: string | null): string {
  if (t === 'FREELANCER') return 'FL'
  return t ?? ''
}

function empTypeClass(t: string | null): string {
  if (t === 'FTE')        return 'bg-blue-100 text-blue-700'
  if (t === 'PM')         return 'bg-purple-100 text-purple-700'
  if (t === 'FREELANCER') return 'bg-gray-100 text-gray-500'
  return 'bg-gray-100 text-gray-400'
}

// ── Employee type badge — editable for admins ─────────────────────────────────

interface EmpBadgeProps {
  row:      UserRow
  isAdmin:  boolean
  onUpdate: (userId: string, newType: string) => void
}

function EmployeeTypeBadge({ row, isAdmin, onUpdate }: EmpBadgeProps) {
  const [editing, setEditing] = useState(false)

  if (!row.employeeType) return null

  if (isAdmin && editing) {
    return (
      <select
        autoFocus
        defaultValue={row.employeeType}
        onChange={async e => {
          const newType = e.target.value
          setEditing(false)
          await fetch('/api/admin/users', {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id: row.userId, employeeType: newType }),
          })
          onUpdate(row.userId, newType)
        }}
        onBlur={() => setEditing(false)}
        className="text-[10px] px-1 py-0.5 rounded border border-blue-300 bg-white focus:outline-none cursor-pointer"
      >
        {EMPLOYEE_TYPES.map(t => (
          <option key={t} value={t}>{empTypeLabel(t) || t}</option>
        ))}
      </select>
    )
  }

  return (
    <span
      title={isAdmin ? 'Click to change type' : undefined}
      onClick={isAdmin ? e => { e.stopPropagation(); setEditing(true) } : undefined}
      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none transition-opacity ${
        isAdmin ? 'cursor-pointer hover:opacity-70' : ''
      } ${empTypeClass(row.employeeType)}`}
    >
      {empTypeLabel(row.employeeType)}
    </span>
  )
}

// ── Batch edit modal ──────────────────────────────────────────────────────────

interface BatchModalProps {
  dates:           string[]
  selectedUserIds: string[]
  users:           UserSummary[]
  onApplied:       () => void
  onClose:         () => void
}

function BatchModal({ dates, selectedUserIds, users, onApplied, onClose }: BatchModalProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>(dates)
  const [status, setStatus]               = useState<AvailabilityStatus>('AVAILABLE')
  const [hours,  setHours]                = useState<number | null>(8)
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

    const tasks: Array<{ userId: string; date: string }> = []
    for (const userId of selectedUserIds)
      for (const date of selectedDates)
        tasks.push({ userId, date })

    const total       = tasks.length
    let   done        = 0
    const CONCURRENCY = 5

    async function runTask(task: { userId: string; date: string }) {
      const u = userById[task.userId]
      await fetch('/api/availability', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId:            task.userId,
          date:              task.date,
          status,
          availabilityHours: needsHours ? hours : null,
          estimatedStartCet: null,
          locale:            u?.locale   ?? null,
          workflow:          u?.workflow  ?? null,
          notes:             '',
        }),
      })
      done++
      setProgress(Math.round((done / total) * 100))
    }

    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      await Promise.all(tasks.slice(i, i + CONCURRENCY).map(runTask))
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
              {VALID_HOURS.map(h => (
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
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
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
  userId:   string
  userName: string
  date:     string
  existing: AvailabilitySubmission | null
  user:     UserSummary | undefined
  onSaved:  () => void
  onClose:  () => void
}

function CellModal({ userId, userName, date, existing, user, onSaved, onClose }: CellModalProps) {
  const [status,    setStatus]    = useState<AvailabilityStatus>(existing?.status ?? 'AVAILABLE')
  const [hours,     setHours]     = useState<number>(existing?.availabilityHours ?? 8)
  const [startTime, setStartTime] = useState(existing?.estimatedStartCet?.slice(0, 5) ?? '09:00')
  const [notes,     setNotes]     = useState(existing?.notes ?? '')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const needsHours     = status === 'AVAILABLE' || status === 'WA'
  const needsStartTime = needsHours && hours > 0

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    const res = await fetch('/api/availability', {
      method:  'POST',
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
              {VALID_HOURS.map(h => (
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

// ── Stats panel ───────────────────────────────────────────────────────────────

type StatsRange = 'week' | 'week-2' | 'week-4'

const RANGE_LABELS: Record<StatsRange, string> = {
  'week':   'This week',
  'week-2': 'Last 2 weeks',
  'week-4': 'Last 4 weeks',
}

function getRangeDates(range: StatsRange): string[] {
  const today = new Date()
  const mon   = new Date(today)
  mon.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  mon.setHours(12, 0, 0, 0)
  const weeks = range === 'week' ? 1 : range === 'week-2' ? 2 : 4
  const start = new Date(mon)
  start.setDate(mon.getDate() - (weeks - 1) * 7)
  const days: string[] = []
  for (let w = 0; w < weeks; w++)
    for (let d = 0; d < 5; d++) {
      const dt = new Date(start)
      dt.setDate(start.getDate() + w * 7 + d)
      days.push(dt.toISOString().slice(0, 10))
    }
  return days
}

function coverageColor(rate: number) {
  if (rate >= 0.8) return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  if (rate >= 0.5) return 'bg-amber-50 border-amber-200 text-amber-700'
  return 'bg-red-50 border-red-200 text-red-600'
}

interface HeatCell { date: string; total: number; avail: number; hours: number; missing: number }
interface HeatRow  { locale: string; label: string; cells: HeatCell[]; totH: number; totA: number; totU: number; isAll?: boolean }

function buildHeatRows(
  users:       UserSummary[],
  subs:        AvailabilitySubmission[],
  dates:       string[],
  locFilter:   string,
  wfFilter:    string,
): HeatRow[] {
  const subMap: Record<string, Record<string, AvailabilitySubmission>> = {}
  for (const s of subs) {
    if (!subMap[s.userId]) subMap[s.userId] = {}
    subMap[s.userId][s.date] = s
  }
  const grouped: Record<string, UserSummary[]> = {}
  for (const u of users) {
    if (!u.locale)                                          continue
    if (locFilter && u.locale !== locFilter)               continue
    if (wfFilter  && (u.workflow ?? '').toLowerCase() !== wfFilter.toLowerCase()) continue
    if (!grouped[u.locale]) grouped[u.locale] = []
    grouped[u.locale].push(u)
  }
  return Object.keys(grouped).sort().map(locale => {
    const us = grouped[locale]
    const cells: HeatCell[] = dates.map(date => {
      let avail = 0, hours = 0, missing = 0
      for (const u of us) {
        const s = subMap[u.id]?.[date]
        if (!s) { missing++ }
        else if (s.status === 'AVAILABLE' || s.status === 'WA') { avail++; hours += s.availabilityHours ?? 0 }
      }
      return { date, total: us.length, avail, hours, missing }
    })
    return {
      locale, label: locale.replace('_', '-'), cells,
      totH: cells.reduce((s, c) => s + c.hours, 0),
      totA: cells.reduce((s, c) => s + c.avail, 0),
      totU: cells.reduce((s, c) => s + c.total, 0),
    }
  })
}

interface StatsPanelProps {
  users:           UserSummary[]
  workflows:       string[]
  filterLocale:    string
  onFilterLocale:  (l: string) => void
  filterWorkflow:  string
  onFilterWorkflow:(w: string) => void
  open:            boolean
  onToggle:        () => void
}

function StatsPanel({ users, workflows, filterLocale, onFilterLocale, filterWorkflow, onFilterWorkflow, open, onToggle }: StatsPanelProps) {
  const [range,   setRange]   = useState<StatsRange>('week')
  const [dates,   setDates]   = useState<string[]>(() => getRangeDates('week'))
  const [subs,    setSubs]    = useState<AvailabilitySubmission[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ds = getRangeDates(range)
    setDates(ds)
    setLoading(true)
    const p = new URLSearchParams({ from: ds[0], to: ds[ds.length - 1] })
    fetch(`/api/availability?${p}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setSubs(Array.isArray(d) ? d : []); setLoading(false) })
  }, [range])

  const rows = useMemo(
    () => buildHeatRows(users, subs, dates, filterLocale, filterWorkflow),
    [users, subs, dates, filterLocale, filterWorkflow],
  )

  const allCells: HeatCell[] = dates.map((date, i) => ({
    date,
    total:   rows.reduce((s, r) => s + r.cells[i].total, 0),
    avail:   rows.reduce((s, r) => s + r.cells[i].avail, 0),
    hours:   rows.reduce((s, r) => s + r.cells[i].hours, 0),
    missing: rows.reduce((s, r) => s + r.cells[i].missing, 0),
  }))
  const totH     = allCells.reduce((s, c) => s + c.hours, 0)
  const totA     = allCells.reduce((s, c) => s + c.avail, 0)
  const totU     = allCells.reduce((s, c) => s + c.total, 0)
  const weekRate = totU > 0 ? totA / totU : 1

  const displayRows: HeatRow[] = filterLocale
    ? rows
    : [{ locale: '__all__', label: 'All', cells: allCells, totH, totA, totU, isAll: true }, ...rows]

  // Group dates into week chunks for column headers
  const weekChunks: string[][] = []
  for (let i = 0; i < dates.length; i += 5) weekChunks.push(dates.slice(i, i + 5))

  const allLocales = [...new Set(users.map(u => u.locale).filter(Boolean) as string[])].sort()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Collapsible header */}
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Team Coverage</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${coverageColor(weekRate)}`}>
            {Math.round(weekRate * 100)}% · {totH}h · {RANGE_LABELS[range].toLowerCase()}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-gray-50">
          {/* Controls */}
          <div className="flex items-start gap-3 px-5 py-3 border-b border-gray-50 flex-wrap">

            {/* Range */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Range</p>
              <div className="flex gap-1">
                {(['week', 'week-2', 'week-4'] as StatsRange[]).map(r => (
                  <button key={r} onClick={() => setRange(r)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      range === r ? 'bg-slate-800 text-white border-slate-800'
                                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {RANGE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px self-stretch bg-gray-100 hidden sm:block" />

            {/* Locale */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Locale / team</p>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => onFilterLocale('')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    !filterLocale ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  All
                </button>
                {allLocales.map(l => (
                  <button key={l} onClick={() => onFilterLocale(filterLocale === l ? '' : l)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      filterLocale === l ? 'bg-blue-600 text-white border-blue-600'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {l.replace('_', '-')}
                  </button>
                ))}
              </div>
            </div>

            {workflows.length > 0 && (
              <>
                <div className="w-px self-stretch bg-gray-100 hidden sm:block" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Workflow</p>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => onFilterWorkflow('')}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        !filterWorkflow ? 'bg-blue-600 text-white border-blue-600'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      All
                    </button>
                    {workflows.map(w => (
                      <button key={w} onClick={() => onFilterWorkflow(filterWorkflow === w ? '' : w)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          filterWorkflow === w ? 'bg-blue-600 text-white border-blue-600'
                                              : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        }`}
                      >
                        {w.charAt(0).toUpperCase() + w.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Heatmap */}
          {loading ? (
            <div className="px-5 py-8 text-center text-xs text-gray-400">Loading coverage data…</div>
          ) : (
            <div className="px-5 py-4 overflow-x-auto">
              <table className="text-xs border-separate border-spacing-y-1" style={{ minWidth: 'max-content' }}>
                <thead>
                  {/* Week group row — only for multi-week ranges */}
                  {weekChunks.length > 1 && (
                    <tr>
                      <th className="pr-4 pb-0.5" />
                      {weekChunks.map((chunk, wi) => (
                        <th key={wi} colSpan={5} className="text-center pb-0.5 font-normal">
                          <span className="text-[10px] text-gray-300">
                            w/c {new Date(chunk[0] + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        </th>
                      ))}
                      <th className="pl-2 pb-0.5" />
                    </tr>
                  )}
                  {/* Day headers */}
                  <tr>
                    <th className="pr-4 pb-1 text-left font-medium text-gray-400 text-[10px] uppercase tracking-wide">Team</th>
                    {dates.map((d, di) => (
                      <th key={d} className={`text-center pb-1 w-[46px] ${di > 0 && di % 5 === 0 ? 'pl-2' : ''}`}>
                        <p className="text-[10px] font-semibold text-gray-500">
                          {new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short' })}
                        </p>
                        <p className="text-[9px] text-gray-300 font-normal leading-none">
                          {new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric' })}
                        </p>
                      </th>
                    ))}
                    <th className="pl-2 pb-1 text-center font-medium text-gray-400 text-[10px] uppercase tracking-wide w-16">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, ri) => {
                    const rowRate = row.totU > 0 ? row.totA / row.totU : 1
                    return (
                      <tr key={row.locale} className={ri === 0 && !filterLocale ? '' : ''}>
                        <td className={`pr-4 py-0.5 ${ri === 1 && !filterLocale ? 'pt-2' : ''}`}>
                          <span className={`text-[11px] font-semibold whitespace-nowrap ${
                            row.isAll ? 'text-gray-400' : 'text-gray-700'
                          }`}>
                            {row.label}
                          </span>
                        </td>
                        {row.cells.map((cell, ci) => {
                          const rate = cell.total > 0 ? cell.avail / cell.total : 1
                          return (
                            <td key={cell.date} className={`py-0.5 ${ci > 0 && ci % 5 === 0 ? 'pl-2' : ''} ${ri === 1 && !filterLocale ? 'pt-2' : ''}`}>
                              <div
                                title={`${cell.avail}/${cell.total} available · ${cell.hours}h${cell.missing ? ` · ${cell.missing} not submitted` : ''}`}
                                className={`rounded-lg border text-center cursor-default w-[42px] py-1.5 ${coverageColor(rate)} ${
                                  row.isAll ? 'opacity-60' : ''
                                }`}
                              >
                                <p className="text-[11px] font-bold leading-none">{cell.hours}h</p>
                                <p className="text-[9px] opacity-70 mt-0.5 leading-none">{cell.avail}/{cell.total}</p>
                              </div>
                            </td>
                          )
                        })}
                        <td className={`pl-2 py-0.5 ${ri === 1 && !filterLocale ? 'pt-2' : ''}`}>
                          <div className={`rounded-lg border text-center w-14 py-1.5 ${coverageColor(rowRate)} ${row.isAll ? 'opacity-60' : ''}`}>
                            <p className="text-[11px] font-bold leading-none">{row.totH}h</p>
                            <p className="text-[9px] opacity-70 mt-0.5 leading-none">{Math.round(rowRate * 100)}%</p>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                {([
                  { label: '≥ 80% available', rate: 0.9 },
                  { label: '50–79%',           rate: 0.65 },
                  { label: '< 50%',            rate: 0.3  },
                ] as const).map(({ label, rate }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-3.5 h-3.5 rounded border ${coverageColor(rate)}`} />
                    <span className="text-[10px] text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const router = useRouter()
  const [me,          setMe]          = useState<SessionUser | null>(null)
  const [users,       setUsers]       = useState<UserSummary[]>([])
  const [submissions, setSubmissions] = useState<AvailabilitySubmission[]>([])
  const [loading,     setLoading]     = useState(false)
  const [weekOffset,  setWeek]        = useState(0)
  const [dates,       setDates]       = useState<string[]>(getWeekDates(0))

  // Admin-only controls
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchOpen,   setBatchOpen]   = useState(false)
  const [cellEdit,    setCellEdit]    = useState<{ userId: string; date: string } | null>(null)

  // Stats panel + grid filters
  const [statsOpen,      setStatsOpen]      = useState(true)
  const [filterLocale,   setFilterLocale]   = useState('')
  const [filterWorkflow, setFilterWorkflow] = useState('')

  const isAdmin = me?.role === 'admin'

  // Auth + initial user list load
  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.status === 401) { router.push('/login'); return null }
      return r.json()
    }).then(data => {
      if (!data) return
      setMe(data.user)
      fetch('/api/users').then(r => r.ok ? r.json() : []).then((us: UserSummary[]) => {
        if (Array.isArray(us)) setUsers(us)
      })
    })
  }, [router])

  const fetchData = useCallback(async (ds: string[]) => {
    if (!me) return
    setLoading(true)
    const params = new URLSearchParams({ from: ds[0], to: ds[ds.length - 1] })
    const res    = await fetch(`/api/availability?${params}`)
    const data   = await res.json()
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

  // ── Role-based visibility (+ active filters) ─────────────────────────────
  function isVisible(u: UserSummary): boolean {
    if (!me) return false
    if (filterLocale   && u.locale   !== filterLocale)                            return false
    if (filterWorkflow && (u.workflow ?? '').toLowerCase() !== filterWorkflow.toLowerCase()) return false
    if (me.role === 'admin') return true
    if (u.locale !== me.locale) return false
    if (me.role === 'lead')       return true
    if (me.role === 'fte')        return u.employeeType === 'FTE'
    if (me.role === 'freelancer') return u.employeeType === 'FREELANCER'
    return false
  }

  // ── Build row map from users (not submissions) ────────────────────────────
  // This ensures every in-scope user appears even with no submissions for the week.
  const rowMap: Record<string, UserRow> = {}
  for (const u of users) {
    if (!isVisible(u)) continue
    rowMap[u.id] = {
      userId:       u.id,
      userName:     u.name,
      role:         u.role,
      employeeType: u.employeeType,
      locale:       u.locale ?? null,
      workflow:     u.workflow ?? null,
      submissions:  {},
    }
  }
  // Overlay actual submissions onto the rows
  for (const s of submissions) {
    if (rowMap[s.userId]) {
      rowMap[s.userId].submissions[s.date] = s
    }
  }

  // ── Group by locale; Management (locale=null) always last ─────────────────
  const groupMap: Record<string, UserRow[]> = {}
  for (const row of Object.values(rowMap)) {
    const key = row.locale ?? '__management__'
    if (!groupMap[key]) groupMap[key] = []
    groupMap[key].push(row)
  }
  // Sort within groups: leads first, then by role order, then alphabetically
  for (const key of Object.keys(groupMap)) {
    groupMap[key].sort((a, b) => {
      const ra = ROLE_ORDER[a.role ?? ''] ?? 10
      const rb = ROLE_ORDER[b.role ?? ''] ?? 10
      if (ra !== rb) return ra - rb
      return a.userName.localeCompare(b.userName)
    })
  }
  const groupKeys = Object.keys(groupMap).filter(k => k !== '__management__').sort()
  if (groupMap['__management__']) groupKeys.push('__management__')

  // ── Unique workflows for filter buttons ──────────────────────────────────
  const workflows = useMemo(
    () => [...new Set(users.map(u => u.workflow).filter(Boolean) as string[])].sort(),
    [users],
  )

  // ── Inline employee type update (from badge edit) ────────────────────────
  function handleEmpTypeUpdate(userId: string, newType: string) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, employeeType: newType } : u))
  }

  const allVisibleIds = Object.values(rowMap).map(r => r.userId)
  const allSelected   = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id))

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(allVisibleIds))
  }

  const weekLabel = weekOffset === 0 ? 'This week'
    : weekOffset === -1 ? 'Last week'
    : weekOffset ===  1 ? 'Next week'
    : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`

  const cellTarget = cellEdit
    ? { user: userById[cellEdit.userId], sub: rowMap[cellEdit.userId]?.submissions[cellEdit.date] ?? null }
    : null

  if (!me) return null

  return (
    <AppLayout title="Team Time Off Dashboard" subtitle="Who's in, who's out — weekly view">
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

        {/* Stats panel — admins and leads only */}
        {(isAdmin || me.role === 'lead') && (
          <StatsPanel
            users={users}
            workflows={workflows}
            filterLocale={filterLocale}
            onFilterLocale={setFilterLocale}
            filterWorkflow={filterWorkflow}
            onFilterWorkflow={setFilterWorkflow}
            open={statsOpen}
            onToggle={() => setStatsOpen(v => !v)}
          />
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {isAdmin && (
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
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
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-400">Loading…</td>
                </tr>
              ) : groupKeys.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-400">No users found</td>
                </tr>
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
                            const ids  = groupMap[key].map(r => r.userId)
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
                    <tr
                      key={row.userId}
                      className={`border-b border-gray-50 hover:bg-gray-50/50 ${selectedIds.has(row.userId) ? 'bg-blue-50/30' : ''}`}
                    >
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
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-gray-900">{row.userName}</p>
                          <EmployeeTypeBadge row={row} isAdmin={isAdmin} onUpdate={handleEmpTypeUpdate} />
                        </div>
                        {row.workflow && <p className="text-xs text-gray-400 mt-0.5">{row.workflow}</p>}
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
                                  <span className="text-[10px] text-gray-400">{s.estimatedStartCet.slice(0, 5)}</span>
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
          {isAdmin && <span className="ml-2 text-blue-500">Click any cell to edit · Select rows for batch edit · Click FTE/FL badge to reassign</span>}
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

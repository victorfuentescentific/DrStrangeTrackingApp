'use client'

import { useEffect, useState, useMemo } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { cn } from '@/lib/utils'
import type { Submission } from '@/lib/submissions'
import { Users, Clock, TrendingUp, CalendarDays } from 'lucide-react'

// ─── Phase config ─────────────────────────────────────────────────────────────

type Phase = '1P+IAA' | '2P' | 'PHI' | 'Review'

const PHASE_COLORS: Record<Phase, { bg: string; text: string; hex: string }> = {
  '1P+IAA': { bg: 'bg-blue-100',   text: 'text-blue-700',   hex: '#3b82f6' },
  '2P':     { bg: 'bg-orange-100', text: 'text-orange-700', hex: '#f97316' },
  'PHI':    { bg: 'bg-green-100',  text: 'text-green-700',  hex: '#22c55e' },
  'Review': { bg: 'bg-slate-100',  text: 'text-slate-600',  hex: '#94a3b8' },
}

const PHASES: Phase[] = ['1P+IAA', '2P', 'PHI', 'Review']

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function getDateRange(filter: DateFilter): { from: string; to: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (filter === 'this-week') {
    const mon = getMondayOfWeek(today)
    return { from: toYMD(mon), to: toYMD(today) }
  }
  if (filter === 'last-7') {
    const past = new Date(today)
    past.setDate(today.getDate() - 6)
    return { from: toYMD(past), to: toYMD(today) }
  }
  // this-month
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: toYMD(firstOfMonth), to: toYMD(today) }
}

function workingDaysElapsed(filter: DateFilter): number {
  const { from, to } = getDateRange(filter)
  const start = new Date(from)
  const end = new Date(to)
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return Math.max(count, 1)
}

function formatDate(s: string): string {
  const [y, m, d] = s.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DateFilter = 'this-week' | 'last-7' | 'this-month'

interface PersonRow {
  userId: string
  userName: string
  locale: string
  totalHours: number
  byPhase: Record<Phase, number>
  lastDate: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminHoursPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<DateFilter>('this-week')

  useEffect(() => {
    async function load() {
      try {
        const [subRes, meRes] = await Promise.all([
          fetch('/api/submissions'),
          fetch('/api/auth/me'),
        ])
        if (meRes.status === 401) {
          setError('You must be logged in as an admin to view this page.')
          return
        }
        const meData = await meRes.json()
        if (!meData.ok || meData.user?.role !== 'admin') {
          setError('Admin access required.')
          return
        }
        if (!subRes.ok) {
          setError('Failed to load submissions.')
          return
        }
        const data: Submission[] = await subRes.json()
        setSubmissions(data)
      } catch {
        setError('Network error — could not load data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Filter submissions by selected date range
  const filtered = useMemo(() => {
    const { from, to } = getDateRange(filter)
    return submissions.filter((s) => s.date >= from && s.date <= to)
  }, [submissions, filter])

  // Summary stats
  const totalHours = useMemo(
    () => filtered.reduce((acc, s) => acc + s.hours, 0),
    [filtered],
  )

  const activeContributors = useMemo(
    () => new Set(filtered.map((s) => s.userId)).size,
    [filtered],
  )

  const avgHoursPerDay = useMemo(
    () => totalHours / workingDaysElapsed(filter),
    [totalHours, filter],
  )

  // By-person breakdown
  const personRows = useMemo<PersonRow[]>(() => {
    const map = new Map<string, PersonRow>()
    for (const s of filtered) {
      if (!map.has(s.userId)) {
        map.set(s.userId, {
          userId: s.userId,
          userName: s.userName,
          locale: s.locale,
          totalHours: 0,
          byPhase: { '1P+IAA': 0, '2P': 0, 'PHI': 0, 'Review': 0 },
          lastDate: s.date,
        })
      }
      const row = map.get(s.userId)!
      row.totalHours += s.hours
      row.byPhase[s.phase as Phase] = (row.byPhase[s.phase as Phase] || 0) + s.hours
      if (s.date > row.lastDate) row.lastDate = s.date
    }
    return [...map.values()].sort((a, b) => b.totalHours - a.totalHours)
  }, [filtered])

  // Phase totals for stacked bar
  const phaseTotals = useMemo(() => {
    const totals: Record<Phase, number> = { '1P+IAA': 0, '2P': 0, 'PHI': 0, 'Review': 0 }
    for (const s of filtered) {
      totals[s.phase as Phase] = (totals[s.phase as Phase] || 0) + s.hours
    }
    return totals
  }, [filtered])

  // Recent submissions (last 20, reverse-chronological)
  const recentSubmissions = useMemo(
    () =>
      [...submissions]
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .slice(0, 20),
    [submissions],
  )

  const filterLabels: { value: DateFilter; label: string }[] = [
    { value: 'this-week', label: 'This week' },
    { value: 'last-7',    label: 'Last 7 days' },
    { value: 'this-month', label: 'This month' },
  ]

  return (
    <AppLayout title="Team Hours" subtitle="Daily submissions by freelancer — actual vs. model hours">
      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
          Loading…
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Date range filter pill toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {filterLabels.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  filter === value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No hours submitted yet.</p>
              <p className="text-slate-400 text-sm">
                Share the <span className="font-mono text-slate-500">/submit</span> link with your freelancers.
              </p>
            </div>
          ) : (
            <>
              {/* Section A — Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                <SummaryCard
                  icon={<Clock className="w-5 h-5 text-blue-500" />}
                  label="Total hours this week"
                  value={totalHours % 1 === 0 ? String(totalHours) : totalHours.toFixed(1)}
                  sub="hours logged"
                  accent="blue"
                />
                <SummaryCard
                  icon={<Users className="w-5 h-5 text-emerald-500" />}
                  label="Active contributors"
                  value={String(activeContributors)}
                  sub="unique freelancers"
                  accent="emerald"
                />
                <SummaryCard
                  icon={<TrendingUp className="w-5 h-5 text-violet-500" />}
                  label="Avg hours / day"
                  value={avgHoursPerDay.toFixed(1)}
                  sub="working days elapsed"
                  accent="violet"
                />
              </div>

              {/* Section C — Hours by Phase stacked bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Hours by Phase</h2>
                <PhaseStackedBar phaseTotals={phaseTotals} totalHours={totalHours} />
                <div className="flex flex-wrap gap-4 mt-3">
                  {PHASES.map((p) => (
                    <div key={p} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm inline-block"
                        style={{ backgroundColor: PHASE_COLORS[p].hex }}
                      />
                      <span className="text-xs text-slate-500">
                        {p}{' '}
                        <span className="font-medium text-slate-700">
                          {phaseTotals[p].toFixed(phaseTotals[p] % 1 === 0 ? 0 : 1)}h
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section B — By-person breakdown table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-700">By Freelancer</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <Th>Name</Th>
                        <Th>Locale</Th>
                        <Th align="right">Total Hours</Th>
                        <Th>Phase Breakdown</Th>
                        <Th>Last Submission</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {personRows.map((row) => (
                        <tr
                          key={row.userId}
                          className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-slate-800">{row.userName}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{row.locale}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {row.totalHours % 1 === 0
                              ? row.totalHours
                              : row.totalHours.toFixed(1)}h
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {PHASES.filter((p) => row.byPhase[p] > 0).map((p) => (
                                <span
                                  key={p}
                                  className={cn(
                                    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
                                    PHASE_COLORS[p].bg,
                                    PHASE_COLORS[p].text,
                                  )}
                                >
                                  {p} ·{' '}
                                  {row.byPhase[p] % 1 === 0
                                    ? row.byPhase[p]
                                    : row.byPhase[p].toFixed(1)}h
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <CalendarDays className="w-3 h-3" />
                              {formatDate(row.lastDate)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section D — Recent submissions */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-700">
                    Recent Submissions
                    <span className="ml-2 text-xs font-normal text-slate-400">(last 20)</span>
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <Th>Date</Th>
                        <Th>Name</Th>
                        <Th>Locale</Th>
                        <Th>Workflow</Th>
                        <Th>Phase</Th>
                        <Th align="right">Hours</Th>
                        <Th>Workset</Th>
                        <Th>Notes</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSubmissions.map((s, idx) => (
                        <tr
                          key={s.id}
                          className={cn(
                            'border-b border-slate-50 hover:bg-slate-50 transition-colors',
                            idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white',
                          )}
                        >
                          <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                            {formatDate(s.date)}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                            {s.userName}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">
                            {s.locale}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs">{s.workflow}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
                                PHASE_COLORS[s.phase as Phase]?.bg ?? 'bg-slate-100',
                                PHASE_COLORS[s.phase as Phase]?.text ?? 'text-slate-600',
                              )}
                            >
                              {s.phase}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-700 text-xs">
                            {s.hours % 1 === 0 ? s.hours : s.hours.toFixed(1)}h
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[120px] truncate">
                            {s.worksetName ?? s.worksetId ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[160px] truncate">
                            {s.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </AppLayout>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent: 'blue' | 'emerald' | 'violet'
}) {
  const accentBg: Record<string, string> = {
    blue:    'bg-blue-50',
    emerald: 'bg-emerald-50',
    violet:  'bg-violet-50',
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', accentBg[accent])}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function PhaseStackedBar({
  phaseTotals,
  totalHours,
}: {
  phaseTotals: Record<Phase, number>
  totalHours: number
}) {
  if (totalHours === 0) return null

  return (
    <div className="flex w-full h-6 rounded-full overflow-hidden gap-px">
      {PHASES.filter((p) => phaseTotals[p] > 0).map((p) => {
        const pct = (phaseTotals[p] / totalHours) * 100
        return (
          <div
            key={p}
            title={`${p}: ${phaseTotals[p].toFixed(1)}h (${pct.toFixed(1)}%)`}
            className="h-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: PHASE_COLORS[p].hex,
            }}
          />
        )
      })}
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  )
}

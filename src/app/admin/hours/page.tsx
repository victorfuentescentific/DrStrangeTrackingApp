'use client'

import { useEffect, useState, useMemo } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { cn } from '@/lib/utils'
import { Users, Clock, TrendingUp, CalendarDays } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailySubmissionRow {
  id: string
  userId: string
  userName: string
  userLocale: string | null
  date: string
  locale: string
  productionHours: number
  hasNonProduction: boolean
  totalNonProductionHours: number
  npHours2pass: number
  npHoursPhi: number
  npHoursTraining: number
  npHoursReview: number
  npHoursOther: number
  totalWorkingHours: number
  remarks: string
  miscCost: number | null
  invoiceUrls: string[]
  submittedAt: string
}

// ─── NP breakdown labels ─────────────────────────────────────────────────────

const NP_KEYS = ['2Pass', 'PHI', 'Training', 'Review', 'Other'] as const

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
  productionHours: number
  npHours: number
  lastDate: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminHoursPage() {
  const [submissions, setSubmissions] = useState<DailySubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<DateFilter>('this-week')

  useEffect(() => {
    async function load() {
      try {
        const [subRes, meRes] = await Promise.all([
          fetch('/api/daily-submissions'),
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
        const data: DailySubmissionRow[] = await subRes.json()
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
    () => filtered.reduce((acc, s) => acc + s.totalWorkingHours, 0),
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
          productionHours: 0,
          npHours: 0,
          lastDate: s.date,
        })
      }
      const row = map.get(s.userId)!
      row.totalHours     += s.totalWorkingHours
      row.productionHours += s.productionHours
      row.npHours        += s.totalNonProductionHours
      if (s.date > row.lastDate) row.lastDate = s.date
    }
    return [...map.values()].sort((a, b) => b.totalHours - a.totalHours)
  }, [filtered])

  // NP breakdown totals
  const npTotals = useMemo(() => ({
    '2Pass':    filtered.reduce((acc, s) => acc + s.npHours2pass,    0),
    'PHI':      filtered.reduce((acc, s) => acc + s.npHoursPhi,      0),
    'Training': filtered.reduce((acc, s) => acc + s.npHoursTraining, 0),
    'Review':   filtered.reduce((acc, s) => acc + s.npHoursReview,   0),
    'Other':    filtered.reduce((acc, s) => acc + s.npHoursOther,    0),
  }), [filtered])

  // Production vs NP totals for stacked bar
  const prodTotal = useMemo(() => filtered.reduce((acc, s) => acc + s.productionHours, 0), [filtered])
  const npTotal   = useMemo(() => filtered.reduce((acc, s) => acc + s.totalNonProductionHours, 0), [filtered])

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

              {/* Section C — Prod vs NP stacked bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Hours Breakdown</h2>
                <ProdNpBar prodTotal={prodTotal} npTotal={npTotal} totalHours={totalHours} />
                <div className="flex flex-wrap gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block bg-brand-500" />
                    <span className="text-xs text-slate-500">Production <span className="font-medium text-slate-700">{prodTotal.toFixed(1)}h</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block bg-amber-400" />
                    <span className="text-xs text-slate-500">Non-Production <span className="font-medium text-slate-700">{npTotal.toFixed(1)}h</span></span>
                  </div>
                </div>
                {/* NP sub-breakdown */}
                {npTotal > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {NP_KEYS.map(k => {
                      const v = npTotals[k]
                      if (v === 0) return null
                      return (
                        <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                          {k}: {v.toFixed(1)}h
                        </span>
                      )
                    })}
                  </div>
                )}
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
                        <Th align="right">Prod h</Th>
                        <Th align="right">NP h</Th>
                        <Th align="right">Total h</Th>
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
                          <td className="px-4 py-3 text-right text-slate-700">
                            {row.productionHours % 1 === 0 ? row.productionHours : row.productionHours.toFixed(1)}h
                          </td>
                          <td className="px-4 py-3 text-right text-amber-600">
                            {row.npHours % 1 === 0 ? row.npHours : row.npHours.toFixed(1)}h
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {row.totalHours % 1 === 0 ? row.totalHours : row.totalHours.toFixed(1)}h
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
                        <Th align="right">Prod h</Th>
                        <Th align="right">NP h</Th>
                        <Th align="right">Total h</Th>
                        <Th>Remarks</Th>
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
                          <td className="px-4 py-2.5 text-right text-slate-700 text-xs">
                            {s.productionHours % 1 === 0 ? s.productionHours : s.productionHours.toFixed(1)}h
                          </td>
                          <td className="px-4 py-2.5 text-right text-amber-600 text-xs">
                            {s.totalNonProductionHours % 1 === 0 ? s.totalNonProductionHours : s.totalNonProductionHours.toFixed(1)}h
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-700 text-xs">
                            {s.totalWorkingHours % 1 === 0 ? s.totalWorkingHours : s.totalWorkingHours.toFixed(1)}h
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[200px] truncate">
                            {s.remarks || '—'}
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

function ProdNpBar({
  prodTotal,
  npTotal,
  totalHours,
}: {
  prodTotal: number
  npTotal: number
  totalHours: number
}) {
  if (totalHours === 0) return null
  const prodPct = (prodTotal / totalHours) * 100
  const npPct   = (npTotal  / totalHours) * 100
  return (
    <div className="flex w-full h-6 rounded-full overflow-hidden gap-px">
      {prodTotal > 0 && (
        <div
          title={`Production: ${prodTotal.toFixed(1)}h (${prodPct.toFixed(1)}%)`}
          className="h-full bg-brand-500 transition-all"
          style={{ width: `${prodPct}%` }}
        />
      )}
      {npTotal > 0 && (
        <div
          title={`Non-Production: ${npTotal.toFixed(1)}h (${npPct.toFixed(1)}%)`}
          className="h-full bg-amber-400 transition-all"
          style={{ width: `${npPct}%` }}
        />
      )}
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

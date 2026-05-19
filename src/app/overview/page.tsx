'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { StatusBadge } from '@/components/availability/StatusBadge'
import { type AvailabilitySubmission } from '@/lib/availability-types'
import { type UserSummary } from '@/app/api/users/route'

interface UserRow {
  userId: string
  userName: string
  employeeType: string | null
  locale: string | null
  workflow: string | null
  submissions: Record<string, AvailabilitySubmission>
}

const LOCALES = ['nl_NL','de_DE','fr_FR','en_GB','da_DK','nb_NO','fi_FI','sv_SE']
const WORKFLOWS = ['DAX','DMO','Scribing']

function getWeekDates(offset = 0): string[] {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7) + offset * 7)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

export default function OverviewPage() {
  const router = useRouter()
  const [authed, setAuthed]       = useState(false)
  const [dates, setDates]         = useState<string[]>(getWeekDates(0))
  const [weekOffset, setWeek]     = useState(0)
  const [submissions, setSubmissions] = useState<AvailabilitySubmission[]>([])
  const [loading, setLoading]     = useState(false)
  const [filterLocale, setFilterLocale]     = useState('')
  const [filterWorkflow, setFilterWorkflow] = useState('')
  const [userMap2, setUserMap2] = useState<Record<string, UserSummary>>({})

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.status === 401) { router.push('/login'); return }
      return r.json()
    }).then(data => {
      if (!['admin','fte'].includes(data?.user?.role)) { router.push('/'); return }
      setAuthed(true)
      // Fetch user list for name resolution
      fetch('/api/users').then(r => r.json()).then((users: UserSummary[]) => {
        if (Array.isArray(users)) {
          setUserMap2(Object.fromEntries(users.map(u => [u.id, u])))
        }
      })
    })
  }, [router])

  const fetchData = useCallback(async (ds: string[]) => {
    setLoading(true)
    const params = new URLSearchParams({ from: ds[0], to: ds[ds.length - 1] })
    if (filterLocale)   params.set('locale', filterLocale)
    if (filterWorkflow) params.set('workflow', filterWorkflow)
    const res  = await fetch(`/api/availability?${params}`)
    const data = await res.json()
    setSubmissions(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterLocale, filterWorkflow])

  useEffect(() => {
    if (!authed) return
    const ds = getWeekDates(weekOffset)
    setDates(ds)
    fetchData(ds)
  }, [authed, weekOffset, fetchData])

  // Group submissions by user, enrich with name from userMap2
  const rowMap: Record<string, UserRow> = {}
  for (const s of submissions) {
    if (!rowMap[s.userId]) {
      const u = userMap2[s.userId]
      rowMap[s.userId] = {
        userId:       s.userId,
        userName:     u?.name ?? s.userId,
        employeeType: u?.employeeType ?? null,
        locale:       u?.locale ?? null,   // user's locale only — null = Management
        workflow:     u?.workflow ?? null,
        submissions:  {},
      }
    }
    rowMap[s.userId].submissions[s.date] = s
  }

  // Group by locale; null locale = Management (goes last)
  const groupMap: Record<string, UserRow[]> = {}
  for (const row of Object.values(rowMap)) {
    const key = row.locale ?? '__management__'
    if (!groupMap[key]) groupMap[key] = []
    groupMap[key].push(row)
  }
  // Sort each group alphabetically by name
  for (const key of Object.keys(groupMap)) {
    groupMap[key].sort((a, b) => a.userName.localeCompare(b.userName))
  }
  // Locale keys alphabetically, management always last
  const groupKeys = Object.keys(groupMap)
    .filter(k => k !== '__management__')
    .sort()
  if (groupMap['__management__']) groupKeys.push('__management__')

  const weekLabel = weekOffset === 0 ? 'This week'
    : weekOffset === -1 ? 'Last week'
    : weekOffset === 1 ? 'Next week'
    : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`

  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  if (!authed) return null

  return (
    <AppLayout title="PM Overview" subtitle="Team availability at a glance">
      <div className="px-4 py-8 space-y-6">

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setWeek(w => w - 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← Prev</button>
          <span className="text-sm font-semibold text-gray-700 min-w-[100px] text-center">{weekLabel}</span>
          <button onClick={() => setWeek(w => w + 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Next →</button>
          <button onClick={() => setWeek(0)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Today</button>

          <select value={filterLocale} onChange={e => setFilterLocale(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
            <option value="">All locales</option>
            {LOCALES.map(l => <option key={l}>{l}</option>)}
          </select>

          <select value={filterWorkflow} onChange={e => setFilterWorkflow(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
            <option value="">All workflows</option>
            {WORKFLOWS.map(w => <option key={w}>{w}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-48">User</th>
                {dates.map(d => (
                  <th key={d} className="text-center px-2 py-3 font-medium text-gray-500 min-w-[120px]">
                    {fmtDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>
              ) : groupKeys.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No submissions for this period</td></tr>
              ) : groupKeys.map(key => (
                <>
                  {/* Group header */}
                  <tr key={`header-${key}`} className="bg-slate-50 border-y border-slate-200">
                    <td colSpan={dates.length + 1} className="px-4 py-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                        {key === '__management__' ? 'Management' : key.replace('_', '-')}
                      </span>
                    </td>
                  </tr>
                  {/* User rows */}
                  {groupMap[key].map(row => (
                    <tr key={row.userId} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{row.userName}</p>
                        {row.workflow && (
                          <p className="text-xs text-gray-400">{row.workflow}</p>
                        )}
                      </td>
                      {dates.map(d => {
                        const s = row.submissions[d]
                        return (
                          <td key={d} className="px-2 py-3 text-center">
                            {s ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <StatusBadge status={s.status} employeeType={row.employeeType} hours={s.availabilityHours} size="sm" />
                                {s.estimatedStartCet && (
                                  <span className="text-[10px] text-gray-400">{s.estimatedStartCet.slice(0,5)}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-200">—</span>
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

        {/* Summary counts */}
        {!loading && dates.map(d => {
          const daySubs = submissions.filter(s => s.date === d)
          const available = daySubs.filter(s => s.status === 'AVAILABLE' || s.status === 'WA').length
          const off = daySubs.filter(s => ['PTO','BH','SL','NO','UL','DH','PATERNITY','OTHER'].includes(s.status)).length
          return (
            <div key={d} />
          )
          return null
        })}
      </div>
    </AppLayout>
  )
}

'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, Search, Users, Pencil } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { HeadcountEditModal } from '@/components/headcount/HeadcountEditModal'
import { HeadcountSummaryCards } from '@/components/headcount/HeadcountSummaryCards'
import { HeadcountRecord, ALL_HC_COLUMNS, normalizeStatus } from '@/lib/headcount-types'

interface ApiResponse {
  records: HeadcountRecord[]
  facets: {
    locales: string[]
    workflows: string[]
    resourceTypes: string[]
    statuses: string[]
  }
}

const STATUS_COLORS: Record<string, string> = {
  Active:     'bg-green-100 text-green-700',
  Inactive:   'bg-amber-100 text-amber-700',
  Offboarded: 'bg-slate-200 text-slate-600',
  Unknown:    'bg-slate-100 text-slate-500',
}

const RESOURCE_TYPE_COLORS: Record<string, string> = {
  FTE:        'bg-blue-50 text-blue-700',
  Freelancer: 'bg-gray-50 text-gray-600',
  Management: 'bg-purple-50 text-purple-700',
}

const ONBOARDING_COLORS: Record<string, string> = {
  Onboarded:    'bg-green-100 text-green-700',
  Pending:      'bg-amber-100 text-amber-700',
  'In Progress': 'bg-blue-50 text-blue-700',
}

function onboardingClass(value: string | null | undefined): string {
  if (!value) return 'bg-slate-100 text-slate-500'
  return ONBOARDING_COLORS[value] ?? 'bg-slate-100 text-slate-600'
}

export default function HeadcountOverviewPage() {
  const router = useRouter()
  const [data,    setData]    = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied,  setDenied]  = useState(false)
  const [role,    setRole]    = useState<string | null>(null)

  // Filters — multi-value
  const [search,        setSearch]        = useState('')
  const [locales,       setLocales]       = useState<string[]>([])
  const [workflows,     setWorkflows]     = useState<string[]>([])
  const [resourceTypes, setResourceTypes] = useState<string[]>([])
  const [statuses,      setStatuses]      = useState<string[]>([])

  // Edit modal
  const [editing, setEditing] = useState<HeadcountRecord | null>(null)

  // Role gate + initial load
  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.status === 401) { router.push('/login'); return null }
      return r.json()
    }).then(me => {
      if (!me) return
      const r = me?.user?.role
      setRole(r)
      if (r !== 'admin' && r !== 'lead') {
        setDenied(true); setLoading(false); return
      }
      load()
    })
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/headcount')
    if (!res.ok) { setLoading(false); return }
    const json: ApiResponse = await res.json()
    setData(json)
    setLoading(false)
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.records.filter(r => {
      if (locales.length       > 0 && !locales.includes(r.locale ?? ''))             return false
      if (workflows.length     > 0 && !workflows.includes(r.workflow ?? ''))         return false
      if (resourceTypes.length > 0 && !resourceTypes.includes(r.resourceType ?? '')) return false
      if (statuses.length      > 0 && !statuses.includes(r.status ?? ''))            return false
      if (q) {
        const hay = [r.name, r.centificEmail, r.personalEmail, r.empId, r.msId, r.oneFormaId]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [data, search, locales, workflows, resourceTypes, statuses])

  function applyEditedRecord(updated: HeadcountRecord) {
    setData(prev => prev ? {
      ...prev,
      records: prev.records.map(r => r.id === updated.id ? updated : r),
    } : prev)
  }

  if (denied) {
    return (
      <AppLayout title="HC Overview" subtitle="Headcount tracker">
        <div className="px-4 py-16 text-center text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">Restricted to Admin and PM roles.</p>
          <p className="text-sm mt-1">Contact your admin if you need access to the headcount tracker.</p>
        </div>
      </AppLayout>
    )
  }

  const total    = data?.records.length ?? 0
  const showing  = filtered.length
  const active   = filtered.filter(r => normalizeStatus(r.status) === 'Active').length
  const inactive = filtered.filter(r => normalizeStatus(r.status) === 'Inactive').length
  const anyFilter = !!search || locales.length + workflows.length + resourceTypes.length + statuses.length > 0
  const isAdmin = role === 'admin'

  return (
    <AppLayout title="HC Overview" subtitle="Headcount tracker — Tier 1">
      <div className="px-4 py-6 space-y-5">

        {/* Top bar: counts + analytics link */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-800">{showing}</span>
            <span className="text-sm text-slate-500">of {total} people</span>
            <span className="inline-flex items-center gap-1 ml-3 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500" /> {active} active
              <span className="w-2 h-2 rounded-full bg-amber-500 ml-2" /> {inactive} inactive
            </span>
          </div>
          {anyFilter && (
            <span className="text-[11px] text-slate-400 italic">(filtered)</span>
          )}
          <Link
            href="/headcount/analytics"
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <BarChart3 className="w-4 h-4" />
            Detailed Analytics
          </Link>
        </div>

        {/* Summary dashboard — respects active filters */}
        <HeadcountSummaryCards records={filtered} />

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, email, ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
          </div>
          <MultiSelect label="Locale"        value={locales}       onChange={setLocales}       options={data?.facets.locales       ?? []} />
          <MultiSelect label="Workflow"      value={workflows}     onChange={setWorkflows}     options={data?.facets.workflows     ?? []} />
          <MultiSelect label="Resource Type" value={resourceTypes} onChange={setResourceTypes} options={data?.facets.resourceTypes ?? []} />
          <MultiSelect label="Status"        value={statuses}      onChange={setStatuses}      options={data?.facets.statuses      ?? []} />
          {anyFilter && (
            <button
              onClick={() => { setSearch(''); setLocales([]); setWorkflows([]); setResourceTypes([]); setStatuses([]) }}
              className="text-xs text-slate-500 hover:text-slate-700 underline ml-1"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-slate-500 font-medium">No people match your filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    {isAdmin && (
                      <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide w-12"></th>
                    )}
                    {ALL_HC_COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className={`px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${col.width ?? ''}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(r => {
                    const norm = normalizeStatus(r.status)
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        {isAdmin && (
                          <td className="px-3 py-2 w-12">
                            <button
                              onClick={() => setEditing(r)}
                              title="Edit record"
                              className="p-1 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                        {ALL_HC_COLUMNS.map(col => {
                          const v = r[col.key]
                          let display: React.ReactNode = v ?? <span className="text-slate-300">—</span>

                          if (col.key === 'status' && v) {
                            display = (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[norm] ?? STATUS_COLORS.Unknown}`}>
                                {String(v)}
                              </span>
                            )
                          } else if (col.key === 'onboardingStatus' && v) {
                            display = (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${onboardingClass(String(v))}`}>
                                {String(v)}
                              </span>
                            )
                          } else if (col.key === 'resourceType' && v) {
                            display = (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${RESOURCE_TYPE_COLORS[String(v)] ?? 'bg-slate-100 text-slate-600'}`}>
                                {String(v)}
                              </span>
                            )
                          } else if (col.key === 'locale' && v) {
                            display = <span className="font-mono text-[11px] text-slate-600">{String(v)}</span>
                          } else if (col.key === 'name' && v) {
                            display = <span className="font-medium text-slate-800">{String(v)}</span>
                          }

                          return (
                            <td key={col.key} className={`px-3 py-2 whitespace-nowrap text-slate-700 ${col.width ?? ''}`}>
                              {display}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Edit modal */}
      {editing && isAdmin && (
        <HeadcountEditModal
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={applyEditedRecord}
        />
      )}
    </AppLayout>
  )
}

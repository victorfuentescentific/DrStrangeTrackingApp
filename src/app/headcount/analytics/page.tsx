'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, UserCheck, UserMinus, UserX } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { HeadcountRecord, HeadcountAnalytics } from '@/lib/headcount-types'

interface ApiResponse {
  records: HeadcountRecord[]
  analytics: HeadcountAnalytics
  facets: {
    locales: string[]
    workflows: string[]
    resourceTypes: string[]
    statuses: string[]
  }
}

export default function HeadcountAnalyticsPage() {
  const router = useRouter()
  const [data,    setData]    = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied,  setDenied]  = useState(false)

  // Multi-select filters
  const [locales,       setLocales]       = useState<string[]>([])
  const [workflows,     setWorkflows]     = useState<string[]>([])
  const [resourceTypes, setResourceTypes] = useState<string[]>([])
  const [statuses,      setStatuses]      = useState<string[]>([])

  // Role gate
  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.status === 401) { router.push('/login'); return null }
      return r.json()
    }).then(me => {
      if (!me) return
      const role = me?.user?.role
      if (role !== 'admin' && role !== 'lead') {
        setDenied(true); setLoading(false); return
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams({ analytics: '1' })
    for (const v of locales)       sp.append('locale',       v)
    for (const v of workflows)     sp.append('workflow',     v)
    for (const v of resourceTypes) sp.append('resourceType', v)
    for (const v of statuses)      sp.append('status',       v)
    const res = await fetch(`/api/headcount?${sp.toString()}`)
    if (!res.ok) { setLoading(false); return }
    const json: ApiResponse = await res.json()
    setData(json)
    setLoading(false)
  }, [locales, workflows, resourceTypes, statuses])

  // Re-fetch when filters change (unless denied)
  useEffect(() => {
    if (denied) return
    load()
  }, [denied, load])

  if (denied) {
    return (
      <AppLayout title="HC Analytics" subtitle="Restricted">
        <div className="px-4 py-16 text-center text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">Restricted to Admin and PM roles.</p>
        </div>
      </AppLayout>
    )
  }

  const a = data?.analytics
  const anyFilter = locales.length + workflows.length + resourceTypes.length + statuses.length > 0

  return (
    <AppLayout title="HC Analytics" subtitle="Breakdown by locale, workflow, resource type, and status">
      <div className="px-4 py-6 space-y-5">

        {/* Back link */}
        <Link
          href="/headcount"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to HC Overview
        </Link>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={<Users      className="w-4 h-4" />} color="slate"  label="Total in scope" value={a?.total    ?? 0} />
          <SummaryCard icon={<UserCheck  className="w-4 h-4" />} color="green"  label="Active"         value={a?.active   ?? 0} />
          <SummaryCard icon={<UserMinus  className="w-4 h-4" />} color="amber"  label="Inactive"       value={a?.inactive ?? 0} />
          <SummaryCard icon={<UserX      className="w-4 h-4" />} color="slate"  label="Offboarded"     value={a?.offboarded ?? 0} />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 mr-1">Filter:</span>
          <MultiSelect label="Locale"        value={locales}       onChange={setLocales}       options={data?.facets.locales       ?? []} />
          <MultiSelect label="Workflow"      value={workflows}     onChange={setWorkflows}     options={data?.facets.workflows     ?? []} />
          <MultiSelect label="Resource Type" value={resourceTypes} onChange={setResourceTypes} options={data?.facets.resourceTypes ?? []} />
          <MultiSelect label="Status"        value={statuses}      onChange={setStatuses}      options={data?.facets.statuses      ?? []} />
          {anyFilter && (
            <button
              onClick={() => { setLocales([]); setWorkflows([]); setResourceTypes([]); setStatuses([]) }}
              className="text-xs text-slate-500 hover:text-slate-700 underline ml-1"
            >
              Clear all
            </button>
          )}
        </div>

        {loading || !a ? (
          <div className="text-center py-16 text-slate-400">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <BreakdownCard title="By Locale"        data={a.byLocale}        />
            <BreakdownCard title="By Workflow"      data={a.byWorkflow}      />
            <BreakdownCard title="By Resource Type" data={a.byResourceType} />
            <BreakdownCard title="By Role"          data={a.byRole}          />
          </div>
        )}

      </div>
    </AppLayout>
  )
}

// ── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({
  icon, color, label, value,
}: {
  icon: React.ReactNode
  color: 'slate' | 'green' | 'amber'
  label: string
  value: number
}) {
  const colorClass = {
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  }[color]
  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
    </div>
  )
}

// ── Breakdown card with stacked bars ────────────────────────────────────────
function BreakdownCard({
  title,
  data,
}: {
  title: string
  data: Record<string, { active: number; inactive: number; offboarded: number; total: number }>
}) {
  const entries = Object.entries(data).sort((a, b) => b[1].total - a[1].total)
  const maxTotal = Math.max(1, ...entries.map(([, v]) => v.total))

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className="text-xs text-slate-400">{entries.length} groups</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">No data.</p>
      ) : (
        <div className="space-y-2.5">
          {entries.map(([key, v]) => {
            const widthPct  = (v.total / maxTotal) * 100
            const activePct = v.total ? (v.active     / v.total) * 100 : 0
            const inactPct  = v.total ? (v.inactive   / v.total) * 100 : 0
            const offPct    = v.total ? (v.offboarded / v.total) * 100 : 0
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 truncate max-w-[70%]">{key}</span>
                  <span className="text-slate-500 font-mono">
                    {v.total}
                    {v.inactive > 0 && <span className="text-amber-600"> · {v.inactive} inact</span>}
                    {v.offboarded > 0 && <span className="text-slate-500"> · {v.offboarded} off</span>}
                  </span>
                </div>
                <div className="h-3 rounded bg-slate-100 overflow-hidden flex" style={{ width: `${widthPct}%`, minWidth: '4rem' }}>
                  <div className="bg-green-500" style={{ width: `${activePct}%` }} />
                  <div className="bg-amber-400" style={{ width: `${inactPct}%` }} />
                  <div className="bg-slate-400" style={{ width: `${offPct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
      {entries.length > 0 && (
        <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500" /> Active</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400" /> Inactive</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded bg-slate-400" /> Offboarded</span>
        </div>
      )}
    </div>
  )
}

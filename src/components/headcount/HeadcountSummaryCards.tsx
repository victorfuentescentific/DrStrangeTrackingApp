'use client'

import { useMemo } from 'react'
import { Users, Briefcase, Globe2, UserCircle2 } from 'lucide-react'
import { HeadcountRecord, normalizeStatus } from '@/lib/headcount-types'

/**
 * Compact, filter-aware dashboard strip for HC Overview.
 * Four cards: Workflow · Resource Type · Locale · Role.
 * Each card shows top buckets with active/inactive split and a proportion bar.
 *
 * Receives the *already-filtered* records, so what you see in the cards
 * always matches what's in the table below.
 */

interface Props {
  records: HeadcountRecord[]
}

type BucketCount = { total: number; active: number; inactive: number; offboarded: number }

function bucketize(records: HeadcountRecord[], key: keyof HeadcountRecord): Record<string, BucketCount> {
  const map: Record<string, BucketCount> = {}
  for (const r of records) {
    const raw = r[key]
    const k = typeof raw === 'string' && raw.trim() ? raw : '—'
    if (!map[k]) map[k] = { total: 0, active: 0, inactive: 0, offboarded: 0 }
    map[k].total++
    const st = normalizeStatus(r.status)
    if (st === 'Active') map[k].active++
    else if (st === 'Inactive') map[k].inactive++
    else if (st === 'Offboarded') map[k].offboarded++
  }
  return map
}

const ACCENTS = {
  blue:   { bar: 'bg-blue-500',   bg: 'bg-blue-50/40',   border: 'border-blue-200',   icon: 'text-blue-600' },
  purple: { bar: 'bg-purple-500', bg: 'bg-purple-50/40', border: 'border-purple-200', icon: 'text-purple-600' },
  green:  { bar: 'bg-green-500',  bg: 'bg-green-50/40',  border: 'border-green-200',  icon: 'text-green-600' },
  amber:  { bar: 'bg-amber-500',  bg: 'bg-amber-50/40',  border: 'border-amber-200',  icon: 'text-amber-600' },
} as const

type Accent = keyof typeof ACCENTS

export function HeadcountSummaryCards({ records }: Props) {
  const byWorkflow     = useMemo(() => bucketize(records, 'workflow'),     [records])
  const byResourceType = useMemo(() => bucketize(records, 'resourceType'), [records])
  const byLocale       = useMemo(() => bucketize(records, 'locale'),       [records])
  const byRole         = useMemo(() => bucketize(records, 'role'),         [records])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <SummaryCard
        title="Workflow"
        icon={<Briefcase className="w-3.5 h-3.5" />}
        accent="blue"
        data={byWorkflow}
        emphasize={['Transcriber', 'Scriber']}
      />
      <SummaryCard
        title="Resource Type"
        icon={<UserCircle2 className="w-3.5 h-3.5" />}
        accent="purple"
        data={byResourceType}
      />
      <SummaryCard
        title="Locale"
        icon={<Globe2 className="w-3.5 h-3.5" />}
        accent="green"
        data={byLocale}
        limit={5}
      />
      <SummaryCard
        title="Role"
        icon={<Users className="w-3.5 h-3.5" />}
        accent="amber"
        data={byRole}
      />
    </div>
  )
}

// ── Single card ──────────────────────────────────────────────────────────────
function SummaryCard({
  title, icon, accent, data, limit = 6, emphasize,
}: {
  title: string
  icon: React.ReactNode
  accent: Accent
  data: Record<string, BucketCount>
  limit?: number
  emphasize?: string[]
}) {
  const a = ACCENTS[accent]
  const entries = Object.entries(data).sort((a, b) => b[1].total - a[1].total)
  const shown   = entries.slice(0, limit)
  const hidden  = entries.length - shown.length
  const hiddenTotal = entries.slice(limit).reduce((s, [, v]) => s + v.total, 0)
  const maxTotal = Math.max(1, ...entries.map(([, v]) => v.total))
  const grandTotal = entries.reduce((s, [, v]) => s + v.total, 0)

  return (
    <div className={`rounded-xl border ${a.border} ${a.bg} p-3.5 flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          <span className={a.icon}>{icon}</span>
          {title}
        </div>
        <span className="text-[11px] text-slate-400 tabular-nums">{grandTotal}</span>
      </div>

      {/* Rows */}
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No data.</p>
      ) : (
        <div className="space-y-1.5">
          {shown.map(([key, v]) => {
            const widthPct = (v.total / maxTotal) * 100
            const isEmph   = emphasize?.includes(key)
            return (
              <div key={key}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className={`truncate ${isEmph ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {key}
                  </span>
                  <span className="tabular-nums text-slate-700 font-medium">
                    {v.total}
                    {v.inactive > 0 && (
                      <span className="text-amber-600 text-[10px] font-normal ml-1">
                        ·{v.inactive}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200/60 overflow-hidden mt-0.5">
                  <div
                    className={`h-full ${a.bar} rounded-full transition-all`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            )
          })}
          {hidden > 0 && (
            <p className="text-[11px] text-slate-400 italic pt-1">
              + {hidden} more ({hiddenTotal})
            </p>
          )}
        </div>
      )}
    </div>
  )
}

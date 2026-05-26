'use client'

import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import { format } from 'date-fns'
import {
  History, ChevronDown, ChevronUp, RefreshCw, TrendingUp,
  Loader2, AlertTriangle, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SnapshotSummary, Snapshot } from '@/lib/projection-store'

// ─── Types ────────────────────────────────────────────────────────────────────
type SummaryItem = SnapshotSummary
type FullSnapshot = Snapshot

function fmtWeek(isoDate: string): string {
  return `W/C ${format(new Date(isoDate + 'T12:00:00'), 'd MMM yyyy')}`
}

function fmtNum(n: number): string {
  return n > 0 ? n.toLocaleString() : '—'
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({
  values,
  color  = '#6366f1',
  width  = 80,
  height = 28,
}: {
  values: number[]
  color?: string
  width?: number
  height?: number
}) {
  if (values.length < 2) return <span className="text-[10px] text-slate-300">—</span>
  const max  = Math.max(...values)
  const min  = Math.min(...values)
  const range = max - min || max || 1
  const pad  = 2
  const pts  = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2)
    const y = (height - pad) - ((v - min) / range) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const lastV = values[values.length - 1]
  const lastX = width - pad
  const lastY = (height - pad) - ((lastV - min) / range) * (height - pad * 2)
  return (
    <svg width={width} height={height} className="inline-block align-middle overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY.toFixed(1)} r={2.5} fill={color} />
    </svg>
  )
}

// ─── Trend Cards (top section) ────────────────────────────────────────────────

function TrendCards({ summaries }: { summaries: SummaryItem[] }) {
  // Oldest-first (summaries arrive newest-first); cap at last 12 weeks
  const chrono = useMemo(() => [...summaries].reverse().slice(-12), [summaries])
  if (chrono.length < 2) return null

  const audioVals = chrono.map(s => s.min_audio)
  const repVals   = chrono.map(s => s.rep)
  const wuVals    = chrono.map(s => s.wu)

  function wowDelta(vals: number[]) {
    const cur  = vals[vals.length - 1]
    const prev = vals[vals.length - 2]
    if (!prev) return null
    const pct = ((cur - prev) / prev) * 100
    return { pct, up: pct >= 0, cur }
  }

  const cards = [
    { label: 'Audio projection',   unit: 'min audio', values: audioVals, color: '#6366f1', d: wowDelta(audioVals) },
    { label: 'Scribing projection', unit: 'rep',       values: repVals,   color: '#f59e0b', d: wowDelta(repVals)   },
    { label: 'PHI projection',      unit: 'WU',        values: wuVals,    color: '#10b981', d: wowDelta(wuVals)    },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map(card => (
        <div key={card.unit} className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            {card.label}
          </p>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xl font-bold text-slate-800">
                {card.d && card.d.cur > 0 ? card.d.cur.toLocaleString() : '—'}
                <span className="text-xs font-medium text-slate-400 ml-1">{card.unit}</span>
              </p>
              {card.d && (
                <p className={cn(
                  'text-[11px] font-semibold mt-0.5',
                  card.d.up ? 'text-green-600' : 'text-red-500',
                )}>
                  {card.d.up ? '▲' : '▼'} {Math.abs(card.d.pct).toFixed(1)}% vs last week
                </p>
              )}
            </div>
            <Sparkline values={card.values} color={card.color} width={80} height={32} />
          </div>
          <p className="text-[10px] text-slate-400 mt-2">{chrono.length} weeks tracked</p>
        </div>
      ))}
    </div>
  )
}

// ─── Monthly Rollup ───────────────────────────────────────────────────────────

interface MonthData {
  month:     string   // e.g. "May 2026"
  sortKey:   string   // e.g. "2026-05" for sorting
  weeks:     number
  min_audio: number
  rep:       number
  wu:        number
}

function MonthlyRollup({ summaries }: { summaries: SummaryItem[] }) {
  const months = useMemo((): MonthData[] => {
    const map: Record<string, MonthData> = {}
    for (const s of summaries) {
      const d      = new Date(s.week_start + 'T12:00:00')
      const sortKey = format(d, 'yyyy-MM')
      const label   = format(d, 'MMM yyyy')
      if (!map[sortKey]) {
        map[sortKey] = { month: label, sortKey, weeks: 0, min_audio: 0, rep: 0, wu: 0 }
      }
      map[sortKey].weeks    += 1
      map[sortKey].min_audio += s.min_audio
      map[sortKey].rep       += s.rep
      map[sortKey].wu        += s.wu
    }
    return Object.values(map).sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  }, [summaries])

  if (months.length === 0) return null

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-brand-500" />
        <span className="text-sm font-semibold text-slate-700">Monthly projection rollup</span>
        <span className="text-[11px] text-slate-400 ml-1">— sum of weekly snapshots</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="text-left  px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Month</th>
            <th className="text-center px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Weeks captured</th>
            <th className="text-right  px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Audio (min)</th>
            <th className="text-right  px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Scribing (rep)</th>
            <th className="text-right  px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">PHI (WU)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {months.map(m => (
            <tr key={m.sortKey} className="hover:bg-slate-50">
              <td className="px-5 py-2.5 text-xs font-semibold text-slate-700">{m.month}</td>
              <td className="px-3 py-2.5 text-center text-xs text-slate-500">{m.weeks}</td>
              <td className="px-3 py-2.5 text-right">
                {m.min_audio > 0
                  ? <><span className="text-xs font-bold text-slate-700">{m.min_audio.toLocaleString()}</span><span className="text-[10px] text-slate-400 ml-1">min</span></>
                  : <span className="text-slate-300 text-xs">—</span>}
              </td>
              <td className="px-3 py-2.5 text-right">
                {m.rep > 0
                  ? <><span className="text-xs font-bold text-slate-700">{m.rep.toLocaleString()}</span><span className="text-[10px] text-slate-400 ml-1">rep</span></>
                  : <span className="text-slate-300 text-xs">—</span>}
              </td>
              <td className="px-5 py-2.5 text-right">
                {m.wu > 0
                  ? <><span className="text-xs font-bold text-slate-700">{m.wu.toLocaleString()}</span><span className="text-[10px] text-slate-400 ml-1">WU</span></>
                  : <span className="text-slate-300 text-xs">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Snapshot Detail Panel (locale-grouped) ───────────────────────────────────

interface LocaleGroup {
  locale:    string
  min_audio: number
  rep:       number
  wu:        number
  worksets:  Array<{
    name:        string
    workflow:    string
    phase_label: string
    is_idle:     boolean
    min_audio:   number
    rep:         number
    wu:          number
  }>
}

function SnapshotDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [snap,    setSnap]    = useState<FullSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetchSnap = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/projections/snapshots/${id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d  => { setSnap(d); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Network error'); setLoading(false) })
  }, [id])

  useEffect(() => { fetchSnap() }, [fetchSnap])

  const byLocale = useMemo((): LocaleGroup[] => {
    if (!snap) return []
    const map: Record<string, LocaleGroup> = {}
    for (const row of snap.rows) {
      if (!map[row.locale]) {
        map[row.locale] = { locale: row.locale, min_audio: 0, rep: 0, wu: 0, worksets: [] }
      }
      map[row.locale].min_audio += row.min_audio
      map[row.locale].rep       += row.rep
      map[row.locale].wu        += row.wu
      map[row.locale].worksets.push({
        name:        row.name,
        workflow:    row.workflow,
        phase_label: row.phase_label,
        is_idle:     row.is_idle,
        min_audio:   row.min_audio,
        rep:         row.rep,
        wu:          row.wu,
      })
    }
    return Object.values(map).sort((a, b) => a.locale.localeCompare(b.locale))
  }, [snap])

  return (
    <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-600">Breakdown by locale</span>
        <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Loading…</span>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 flex items-center gap-3 text-red-600 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={fetchSnap} className="underline hover:text-red-800">Retry</button>
        </div>
      )}

      {snap && !loading && byLocale.length === 0 && (
        <p className="px-4 py-6 text-xs text-center text-slate-400">No rows recorded.</p>
      )}

      {snap && !loading && byLocale.length > 0 && (
        <div className="divide-y divide-slate-100">
          {byLocale.map(loc => (
            <div key={loc.locale} className="px-4 py-3">
              {/* Locale summary row */}
              <div className="flex items-center gap-3 mb-1.5">
                <span className="font-mono text-xs font-bold text-slate-700 w-16">{loc.locale}</span>
                <span className="text-[10px] text-slate-400">
                  {loc.worksets.length} workset{loc.worksets.length !== 1 ? 's' : ''}
                </span>
                <div className="ml-auto flex items-center gap-5 text-[11px] text-slate-600">
                  {loc.min_audio > 0 && (
                    <span><strong className="text-slate-800">{loc.min_audio.toLocaleString()}</strong> min audio</span>
                  )}
                  {loc.rep > 0 && (
                    <span><strong className="text-slate-800">{loc.rep.toLocaleString()}</strong> rep</span>
                  )}
                  {loc.wu > 0 && (
                    <span><strong className="text-slate-800">{loc.wu.toLocaleString()}</strong> WU</span>
                  )}
                </div>
              </div>

              {/* Individual workset rows */}
              <div className="ml-4 space-y-0.5">
                {loc.worksets.map((ws, wi) => (
                  <div
                    key={wi}
                    className={cn(
                      'flex items-center gap-2 text-[11px] py-0.5',
                      ws.is_idle ? 'opacity-40' : '',
                    )}
                  >
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0',
                      ws.is_idle ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-700',
                    )}>
                      {ws.phase_label}
                    </span>
                    <span className="text-slate-600 truncate max-w-[200px]">{ws.name}</span>
                    <span className="text-slate-400 shrink-0">{ws.workflow}</span>
                    <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-400 shrink-0">
                      {ws.min_audio > 0 && <span>{ws.min_audio.toLocaleString()} min</span>}
                      {ws.rep       > 0 && <span>{ws.rep.toLocaleString()} rep</span>}
                      {ws.wu        > 0 && <span>{ws.wu.toLocaleString()} WU</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Trend dot ────────────────────────────────────────────────────────────────

function TrendDot({ value, prev }: { value: number; prev: number | undefined }) {
  if (prev === undefined || value === prev) return null
  const up = value > prev
  return (
    <span className={cn('ml-1 text-[9px] font-bold', up ? 'text-green-600' : 'text-red-500')}>
      {up ? '▲' : '▼'}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectionHistory({ isAdmin }: { isAdmin: boolean }) {
  const [summaries,   setSummaries]   = useState<SummaryItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [triggering,  setTriggering]  = useState(false)
  const [triggerMsg,  setTriggerMsg]  = useState<string | null>(null)
  const [showMonthly, setShowMonthly] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/projections/snapshots')
      .then(r  => r.json())
      .then(d  => { setSummaries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Network error'); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  async function triggerSnapshot() {
    setTriggering(true)
    setTriggerMsg(null)
    const res = await fetch('/api/projections/snapshots', { method: 'POST' })
    const d   = await res.json()
    setTriggering(false)
    if (!res.ok)        setTriggerMsg(`Error: ${d.error}`)
    else if (d.skipped) setTriggerMsg('Already snapped this week — no duplicate created.')
    else                { setTriggerMsg('Snapshot created!'); load() }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-brand-500" />
          <h2 className="text-sm font-bold text-slate-800">Weekly snapshot history</h2>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={triggerSnapshot}
              disabled={triggering}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {triggering
                ? <><Loader2 className="w-3 h-3 animate-spin" />Capturing…</>
                : <><TrendingUp className="w-3 h-3" />Capture now</>}
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {triggerMsg && (
        <p className="text-xs px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
          {triggerMsg}
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading && !summaries.length && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading history…</span>
        </div>
      )}

      {!loading && !error && summaries.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <p className="text-slate-400 text-sm">No snapshots yet.</p>
          {isAdmin && (
            <p className="text-slate-400 text-xs mt-1">
              Snapshots are captured automatically every Monday at 07:00 CET,<br />
              or click &quot;Capture now&quot; above.
            </p>
          )}
        </div>
      )}

      {/* ── Trend sparkline cards ── */}
      {summaries.length >= 2 && <TrendCards summaries={summaries} />}

      {/* ── Monthly rollup (collapsible) ── */}
      {summaries.length >= 2 && (
        <div>
          <button
            onClick={() => setShowMonthly(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 mb-2 transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Monthly rollup
            {showMonthly
              ? <ChevronUp   className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showMonthly && <MonthlyRollup summaries={summaries} />}
        </div>
      )}

      {/* ── Week-by-week table ── */}
      {summaries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">Week by week</span>
            <span className="text-[11px] text-slate-400 ml-2">— click a row to see locale breakdown</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left  px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Week</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Worksets</th>
                <th className="text-right  px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Audio proj.</th>
                <th className="text-right  px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rep proj.</th>
                <th className="text-right  px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">WU proj.</th>
                <th className="text-right  px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Snapped</th>
                <th className="px-3 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summaries.map((s, i) => {
                const prev   = summaries[i + 1]
                const isOpen = expanded === s.id
                return (
                  <Fragment key={s.id}>
                    <tr
                      onClick={() => setExpanded(prev => (prev === s.id ? null : s.id))}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <p className="text-xs font-semibold text-slate-700">{fmtWeek(s.week_start)}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{s.week_start}</p>
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-slate-600">{s.workset_count}</td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs font-semibold text-slate-700">{fmtNum(s.min_audio)}</span>
                        <TrendDot value={s.min_audio} prev={prev?.min_audio} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs font-semibold text-slate-700">{fmtNum(s.rep)}</span>
                        <TrendDot value={s.rep} prev={prev?.rep} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs font-semibold text-slate-700">{fmtNum(s.wu)}</span>
                        <TrendDot value={s.wu} prev={prev?.wu} />
                      </td>
                      <td className="px-3 py-3 text-right text-[11px] text-slate-400">
                        {format(new Date(s.snapped_at), 'dd MMM HH:mm')}
                        {s.created_by === 'cron' && (
                          <span className="ml-1 text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">auto</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-400">
                        {isOpen
                          ? <ChevronUp   className="w-3.5 h-3.5 inline" />
                          : <ChevronDown className="w-3.5 h-3.5 inline" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${s.id}-detail`}>
                        <td colSpan={7} className="px-5 pb-4">
                          <SnapshotDetailPanel id={s.id} onClose={() => setExpanded(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Snapshots capture projected weekly output at the moment of recording.
        Cron runs automatically every Monday at 07:00 CET.
        Monthly rollup sums the weekly snapshot values — it is a projection estimate, not actual output.
      </p>
    </div>
  )
}

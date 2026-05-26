'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { format } from 'date-fns'
import { History, ChevronDown, ChevronUp, RefreshCw, TrendingUp, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SnapshotSummary, Snapshot } from '@/lib/projection-store'

// ─── Types ────────────────────────────────────────────────────────────────────
// Mirror server types locally (no server import in 'use client')
type SummaryItem = SnapshotSummary
type FullSnapshot = Snapshot

function fmtWeek(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00')
  return `W/C ${format(d, 'd MMM yyyy')}`
}

function fmtNum(n: number): string {
  return n > 0 ? n.toLocaleString() : '—'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrendDot({ value, prev }: { value: number; prev: number | undefined }) {
  if (prev === undefined || value === prev) return null
  const up = value > prev
  return (
    <span className={cn('ml-1 text-[9px] font-bold', up ? 'text-green-600' : 'text-red-500')}>
      {up ? '▲' : '▼'}
    </span>
  )
}

function SnapshotDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [snap,    setSnap]    = useState<FullSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/projections/snapshots/${id}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { setSnap(d); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Network error'); setLoading(false) })
  }, [id])

  return (
    <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-600">Workset breakdown</span>
        <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600">Close</button>
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
          <button
            onClick={() => { setError(null); setLoading(true); fetch(`/api/projections/snapshots/${id}`).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))).then(d => { setSnap(d); setLoading(false) }).catch(e => { setError(e.message); setLoading(false) }) }}
            className="text-red-600 underline hover:text-red-800"
          >Retry</button>
        </div>
      )}

      {snap && !loading && (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Workset</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Locale</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Phase</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Audio</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Rep</th>
              <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">WU</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {snap.rows.map(row => (
              <tr key={row.id} className={cn('hover:bg-slate-50', row.is_idle && 'opacity-50')}>
                <td className="px-4 py-2 font-medium text-slate-700 max-w-[180px] truncate">{row.name}</td>
                <td className="px-3 py-2 font-mono text-slate-500">{row.locale}</td>
                <td className="px-3 py-2">
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                    row.is_idle ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-700',
                  )}>
                    {row.phase_label}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-slate-600">{fmtNum(row.min_audio)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmtNum(row.rep)}</td>
                <td className="px-4 py-2 text-right text-slate-600">{fmtNum(row.wu)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/projections/snapshots')
      .then(r => r.json())
      .then(d => { setSummaries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  async function triggerSnapshot() {
    setTriggering(true)
    setTriggerMsg(null)
    const res = await fetch('/api/projections/snapshots', { method: 'POST' })
    const d   = await res.json()
    setTriggering(false)
    if (!res.ok)       setTriggerMsg(`Error: ${d.error}`)
    else if (d.skipped) setTriggerMsg('Already snapped this week — no duplicate created.')
    else               { setTriggerMsg('Snapshot created!'); load() }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => (prev === id ? null : id))
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
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
              or click "Capture now" above.
            </p>
          )}
        </div>
      )}

      {summaries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Week</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Worksets</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Audio proj.</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rep proj.</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">WU proj.</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Snapped</th>
                <th className="px-3 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summaries.map((s, i) => {
                const prev = summaries[i + 1]
                const isOpen = expanded === s.id
                return (
                  <Fragment key={s.id}>
                    <tr
                      onClick={() => toggleExpand(s.id)}
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
                          ? <ChevronUp className="w-3.5 h-3.5 inline" />
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
      </p>
    </div>
  )
}

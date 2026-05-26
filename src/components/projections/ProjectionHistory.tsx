'use client'

import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ClipboardList, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalcSession {
  id:              string
  locale:          string
  workflow:        string
  hc:              number
  total_hours:     number
  iaa_days:        number
  p2_days:         number
  phi_days:        number
  output_full:     number
  output_buffered: number
  unit:            string
  label:           string | null
  created_at:      string
}

const UNIT_BADGE: Record<string, string> = {
  'min audio': 'bg-indigo-100 text-indigo-700',
  'rep':       'bg-amber-100  text-amber-700',
  'WU':        'bg-emerald-100 text-emerald-700',
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function Pill({
  label,
  active,
  onClick,
}: {
  label:   string
  active:  boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors',
        active
          ? 'bg-brand-600 text-white border-brand-600'
          : 'bg-white text-slate-600 border-slate-200 hover:border-brand-400',
      )}
    >
      {label}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

// isAdmin prop is kept for interface compatibility but not used in this view.
export function ProjectionHistory({ isAdmin: _isAdmin }: { isAdmin: boolean }) {
  const [sessions, setSessions]             = useState<CalcSession[]>([])
  const [loading,  setLoading]              = useState(true)
  const [error,    setError]                = useState<string | null>(null)
  const [localeFilter,   setLocaleFilter]   = useState<string>('all')
  const [workflowFilter, setWorkflowFilter] = useState<string>('all')

  function load() {
    setLoading(true)
    setError(null)
    fetch('/api/calculator-sessions')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d  => { setSessions(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Network error'); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const allLocales   = useMemo(() => [...new Set(sessions.map(s => s.locale))].sort(),   [sessions])
  const allWorkflows = useMemo(() => [...new Set(sessions.map(s => s.workflow))].sort(), [sessions])

  const filtered = useMemo(
    () =>
      sessions.filter(
        s =>
          (localeFilter   === 'all' || s.locale   === localeFilter) &&
          (workflowFilter === 'all' || s.workflow === workflowFilter),
      ),
    [sessions, localeFilter, workflowFilter],
  )

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-brand-500" />
          <h2 className="text-sm font-bold text-slate-800">Production Calculator Log</h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Filters ── */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">Locale:</span>
          {['all', ...allLocales].map(l => (
            <Pill
              key={l}
              label={l === 'all' ? 'All' : l}
              active={localeFilter === l}
              onClick={() => setLocaleFilter(l)}
            />
          ))}
          <span className="text-[11px] font-semibold text-slate-500 shrink-0 ml-3">Workflow:</span>
          {['all', ...allWorkflows].map(w => (
            <Pill
              key={w}
              label={w === 'all' ? 'All' : w}
              active={workflowFilter === w}
              onClick={() => setWorkflowFilter(w)}
            />
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && !sessions.length && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading log…</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && sessions.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">No saved calculations yet</p>
          <p className="text-slate-400 text-xs mt-1.5">
            Save a calculation from the <strong>Production Calculator</strong> tab.
          </p>
        </div>
      )}

      {/* ── Log table ── */}
      {filtered.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left  px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Date</th>
                <th className="text-left  px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Locale</th>
                <th className="text-left  px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Workflow</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">HC</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hours</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">IAA</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">2P</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">PHI</th>
                <th className="text-right  px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">1P Output</th>
                <th className="text-right  px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Buffered</th>
                <th className="text-left  px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">

                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {format(new Date(s.created_at), 'dd MMM yyyy HH:mm')}
                  </td>

                  <td className="px-3 py-3">
                    <span className="font-mono text-xs font-semibold text-slate-700">{s.locale}</span>
                  </td>

                  <td className="px-3 py-3 text-xs text-slate-600">{s.workflow}</td>

                  <td className="px-3 py-3 text-center text-xs text-slate-600">{s.hc}</td>

                  <td className="px-3 py-3 text-center text-xs text-slate-600">{s.total_hours}h</td>

                  <td className="px-3 py-3 text-center text-xs text-slate-400">
                    {s.iaa_days > 0 ? `${s.iaa_days}d` : '—'}
                  </td>

                  <td className="px-3 py-3 text-center text-xs text-slate-400">
                    {s.p2_days > 0 ? `${s.p2_days}d` : '—'}
                  </td>

                  <td className="px-3 py-3 text-center text-xs text-slate-400">
                    {s.phi_days > 0 ? `${s.phi_days}d` : '—'}
                  </td>

                  <td className="px-3 py-3 text-right">
                    <span className="text-xs font-bold text-slate-800">
                      {s.output_full.toLocaleString()}
                    </span>
                    <span className={cn(
                      'ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                      UNIT_BADGE[s.unit] ?? 'bg-slate-100 text-slate-500',
                    )}>
                      {s.unit}
                    </span>
                  </td>

                  <td className="px-3 py-3 text-right text-xs text-slate-500">
                    {s.output_buffered > 0 ? s.output_buffered.toLocaleString() : '—'}
                  </td>

                  <td className="px-5 py-3 text-xs text-slate-500 max-w-[160px] truncate">
                    {s.label ?? <span className="text-slate-300">—</span>}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-5 py-2 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[11px] text-slate-400">
              {filtered.length < sessions.length
                ? `Showing ${filtered.length} of ${sessions.length} sessions`
                : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} total`}
            </p>
          </div>
        </div>
      )}

      {/* Filter no-match */}
      {!loading && filtered.length === 0 && sessions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-400 text-xs">No sessions match the current filters.</p>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Full record of all production calculations saved by you, newest first.
        Go to the <strong>Production Calculator</strong> tab to run and save new calculations.
      </p>
    </div>
  )
}

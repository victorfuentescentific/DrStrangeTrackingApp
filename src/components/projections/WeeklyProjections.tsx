'use client'

import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { BarChart2, Loader2, AlertTriangle, Users, Calculator, RefreshCw } from 'lucide-react'
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

// ─── Visual constants ─────────────────────────────────────────────────────────

const UNIT_BAR: Record<string, string> = {
  'min audio': 'bg-indigo-500',
  'rep':       'bg-amber-500',
  'WU':        'bg-emerald-500',
}

const UNIT_BADGE: Record<string, string> = {
  'min audio': 'bg-indigo-100 text-indigo-700',
  'rep':       'bg-amber-100  text-amber-700',
  'WU':        'bg-emerald-100 text-emerald-700',
}

const UNIT_LABEL: Record<string, string> = {
  'min audio': 'min audio',
  'rep':       'rep',
  'WU':        'WU',
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────

function HBar({ value, max, unit }: { value: number; max: number; unit: string }) {
  const pct   = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const color = UNIT_BAR[unit] ?? 'bg-slate-400'
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          style={{ width: `${pct}%` }}
          className={cn('h-2.5 rounded-full transition-all duration-500', color)}
        />
      </div>
      <span className="text-[10px] text-slate-400 w-7 text-right shrink-0">{pct}%</span>
    </div>
  )
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function Pill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
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

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WeeklyProjections() {
  const [sessions, setSessions]           = useState<CalcSession[]>([])
  const [loading,  setLoading]            = useState(true)
  const [error,    setError]              = useState<string | null>(null)
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

  // Group: locale → workflow → most-recent session (sessions arrive newest-first)
  const grouped = useMemo(() => {
    const g: Record<string, Record<string, CalcSession>> = {}
    for (const s of filtered) {
      if (!g[s.locale])            g[s.locale] = {}
      if (!g[s.locale][s.workflow]) g[s.locale][s.workflow] = s
    }
    return g
  }, [filtered])

  const localeKeys = useMemo(() => Object.keys(grouped).sort(), [grouped])

  // Global max for bar sizing — across all filtered sessions
  const maxOutput = useMemo(
    () => Math.max(0, ...filtered.map(s => s.output_full)),
    [filtered],
  )

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-brand-500" />
          <h2 className="text-sm font-bold text-slate-800">Production projections dashboard</h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          title="Refresh"
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
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

      {/* ── Loading ── */}
      {loading && !sessions.length && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading projections…</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && sessions.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <Calculator className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">No saved projections yet</p>
          <p className="text-slate-400 text-xs mt-1.5">
            Go to the <strong>Production Calculator</strong> tab, run a calculation, and hit Save.
          </p>
        </div>
      )}

      {sessions.length > 0 && (
        <>
          {/* ── Summary cards ── */}
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard
              label="Saved sessions"
              value={sessions.length}
              sub="across all locales and workflows"
            />
            <SummaryCard
              label="Locales covered"
              value={allLocales.length}
              sub={allLocales.slice(0, 5).join(' · ') + (allLocales.length > 5 ? ' …' : '')}
            />
            <SummaryCard
              label="Last saved"
              value={format(new Date(sessions[0].created_at), 'dd MMM HH:mm')}
              sub={`${sessions[0].locale} · ${sessions[0].workflow}`}
            />
          </div>

          {/* ── Filters ── */}
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

          {/* ── Locale cards ── */}
          {localeKeys.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              No sessions match the current filters.
            </p>
          ) : (
            <div className="space-y-4">
              {localeKeys.map(locale => {
                const workflows = grouped[locale]
                const wfKeys    = Object.keys(workflows).sort()

                return (
                  <div
                    key={locale}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                  >
                    {/* Card header */}
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-slate-800">{locale}</span>
                      <span className="text-[11px] text-slate-400">
                        {wfKeys.length} workflow{wfKeys.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Workflow rows */}
                    <div className="divide-y divide-slate-50">
                      {wfKeys.map(wf => {
                        const s = workflows[wf]
                        return (
                          <div key={wf} className="px-5 py-3.5 flex items-center gap-4">

                            {/* Workflow label + HC */}
                            <div className="w-28 shrink-0">
                              <p className="text-xs font-semibold text-slate-700">{wf}</p>
                              <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                                <Users className="w-2.5 h-2.5" />
                                HC {s.hc}
                                <span className="ml-1.5">{s.total_hours}h</span>
                              </p>
                            </div>

                            {/* Bar */}
                            <HBar value={s.output_full} max={maxOutput} unit={s.unit} />

                            {/* Output value */}
                            <div className="text-right shrink-0 w-32">
                              <p className="text-sm font-bold text-slate-800">
                                {s.output_full.toLocaleString()}
                              </p>
                              <span className={cn(
                                'text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                                UNIT_BADGE[s.unit] ?? 'bg-slate-100 text-slate-500',
                              )}>
                                {UNIT_LABEL[s.unit] ?? s.unit}
                              </span>
                            </div>

                            {/* Buffered output (if different) */}
                            {s.output_buffered > 0 && s.output_buffered !== s.output_full && (
                              <div className="text-right shrink-0 w-28 hidden sm:block">
                                <p className="text-xs font-semibold text-slate-500">
                                  {s.output_buffered.toLocaleString()}
                                </p>
                                <p className="text-[10px] text-slate-400">buffered</p>
                              </div>
                            )}

                            {/* Label + date */}
                            <div className="text-right shrink-0 w-28">
                              {s.label && (
                                <p className="text-[10px] text-brand-600 font-medium truncate">
                                  {s.label}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-300">
                                {format(new Date(s.created_at), 'dd MMM HH:mm')}
                              </p>
                            </div>

                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-slate-400">
        Shows the most recent saved calculation per locale / workflow combination.
        Use the <strong>Production Calculator</strong> tab to create and save new projections.
        View the full log in <strong>Production Calculator Log</strong>.
      </p>
    </div>
  )
}

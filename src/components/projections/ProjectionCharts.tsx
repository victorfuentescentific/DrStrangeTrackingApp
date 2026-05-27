'use client'

import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { TrendingUp, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChartSession {
  id:              string
  locale:          string
  workflow:        string
  output_full:     number
  output_buffered: number
  unit:            string
  date_from:       string | null
  date_to:         string | null
  created_at:      string
  label:           string | null
}

// ─── Colour palettes ──────────────────────────────────────────────────────────

const LOCALE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6',
]

const WORKFLOW_COLORS: Record<string, string> = {
  'DAX Transcribing':  '#6366f1',
  'DMO Transcription': '#f59e0b',
  'Scribing':          '#10b981',
}

const KNOWN_WORKFLOWS = ['DAX Transcribing', 'DMO Transcription', 'Scribing']

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the date to plot on the x-axis: date_from if set, else created_at date. */
function effectiveDate(s: ChartSession): string {
  return s.date_from ?? s.created_at.slice(0, 10)
}

function fmtDate(d: string | number): string {
  try {
    const str = typeof d === 'number' ? String(d) : d
    return format(parseISO(str), 'dd MMM')
  } catch {
    return String(d)
  }
}

function localeColor(locale: string, allLocales: string[]): string {
  return LOCALE_COLORS[allLocales.indexOf(locale) % LOCALE_COLORS.length]
}

function workflowColor(wf: string): string {
  return WORKFLOW_COLORS[wf] ?? '#94a3b8'
}

// ─── Custom tooltips ──────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  dataKey: string
  color:   string
  fill:    string
  value:   number
}

interface TooltipProps {
  active?:  boolean
  payload?: TooltipPayloadItem[]
  label?:   string
}

function LineTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-bold text-slate-700 mb-2">{fmtDate(label ?? '')}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-600 w-24 truncate font-mono">{p.dataKey}</span>
          <span className="font-bold text-slate-800 ml-auto pl-3">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function BarTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-bold text-slate-700 mb-2 font-mono">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
          <span className="text-slate-600">{p.dataKey}</span>
          <span className="font-bold text-slate-800 ml-auto pl-3">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ProjectionChartsProps {
  sessions: ChartSession[]
}

export function ProjectionCharts({ sessions }: ProjectionChartsProps) {
  const allLocales   = useMemo(() => [...new Set(sessions.map(s => s.locale))].sort(),   [sessions])
  const allWorkflows = useMemo(() => [...new Set(sessions.map(s => s.workflow))].sort(), [sessions])

  // Locale toggle pills — all on by default
  const [activeLocales,  setActiveLocales]  = useState<Set<string>>(() => new Set(allLocales))
  const [workflowFilter, setWorkflowFilter] = useState<string>('All')

  // Sync new locales that appear after mount (e.g. data refresh)
  useMemo(() => {
    setActiveLocales(prev => {
      const next = new Set(prev)
      for (const l of allLocales) next.add(l)
      return next
    })
  }, [allLocales])

  // Sessions filtered by active workflow tab
  const sessionsForWorkflow = useMemo(
    () => workflowFilter === 'All' ? sessions : sessions.filter(s => s.workflow === workflowFilter),
    [sessions, workflowFilter],
  )

  // ── Line chart data: one row per distinct date, keyed by locale ────────────
  const lineData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>()
    for (const s of sessionsForWorkflow) {
      const d = effectiveDate(s)
      if (!dateMap.has(d)) dateMap.set(d, {})
      const row = dateMap.get(d)!
      // Keep max output for that locale on that date (multiple sessions possible)
      if (row[s.locale] === undefined || s.output_full > row[s.locale]) {
        row[s.locale] = s.output_full
      }
    }
    return [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, localesMap]) => ({ date, ...localesMap }))
  }, [sessionsForWorkflow])

  // ── Bar chart data: latest output per locale + workflow ─────────────────────
  const barData = useMemo(() => {
    // Sessions come newest-first from API; build latest-per-combo by iterating newest first
    const seen = new Set<string>()
    const latest: ChartSession[] = []
    for (const s of sessionsForWorkflow) {
      const key = `${s.locale}|${s.workflow}`
      if (!seen.has(key)) { seen.add(key); latest.push(s) }
    }

    const byLocale: Record<string, Record<string, number>> = {}
    for (const s of latest) {
      if (!byLocale[s.locale]) byLocale[s.locale] = {}
      byLocale[s.locale][s.workflow] = s.output_full
    }
    return Object.entries(byLocale)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([locale, wfs]) => ({ locale, ...wfs }))
  }, [sessionsForWorkflow])

  const visibleLocales = useMemo(
    () => allLocales.filter(l => activeLocales.has(l)),
    [allLocales, activeLocales],
  )

  function toggleLocale(locale: string) {
    setActiveLocales(prev => {
      const next = new Set(prev)
      if (next.has(locale)) {
        if (next.size > 1) next.delete(locale) // keep at least one
      } else {
        next.add(locale)
      }
      return next
    })
  }

  // Workflows available in this dataset (ordered canonically)
  const availableWorkflows = useMemo(() => {
    const inData = new Set(allWorkflows)
    const canonical = KNOWN_WORKFLOWS.filter(w => inData.has(w))
    // Append any unknown workflow names
    for (const w of allWorkflows) if (!canonical.includes(w)) canonical.push(w)
    return canonical
  }, [allWorkflows])

  const workflowTabs = useMemo(
    () => ['All', ...availableWorkflows],
    [availableWorkflows],
  )

  if (sessions.length === 0) return null

  return (
    <div className="space-y-6">

      {/* ── Workflow filter tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {workflowTabs.map(w => (
          <button
            key={w}
            onClick={() => setWorkflowFilter(w)}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap',
              workflowFilter === w
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {w}
          </button>
        ))}
      </div>

      {/* ── Line chart: output evolution over time ───────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        {/* Header + locale toggle pills */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-500 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">Output evolution by locale</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                x-axis = production window start date · y-axis = 1P output
              </p>
            </div>
          </div>

          {/* Locale toggle pills */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-sm">
            {allLocales.map(locale => (
              <button
                key={locale}
                onClick={() => toggleLocale(locale)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border transition-all',
                  activeLocales.has(locale)
                    ? 'text-white border-transparent'
                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400',
                )}
                style={
                  activeLocales.has(locale)
                    ? { backgroundColor: localeColor(locale, allLocales), borderColor: localeColor(locale, allLocales) }
                    : {}
                }
              >
                {locale}
              </button>
            ))}
          </div>
        </div>

        {lineData.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
            <TrendingUp className="w-8 h-8 text-slate-200" />
            <p className="text-xs text-slate-400 max-w-xs">
              Save at least <strong>2 projections</strong> with a{' '}
              <strong>production window date</strong> to see the evolution chart.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={lineData} margin={{ top: 4, right: 24, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={v => (v as number) >= 1000 ? `${Math.round((v as number) / 1000)}k` : String(v)}
              />
              <Tooltip content={<LineTooltip />} />
              <Brush
                dataKey="date"
                height={24}
                tickFormatter={fmtDate}
                stroke="#e2e8f0"
                fill="#f8fafc"
                travellerWidth={7}
                className="mt-2"
              />
              {visibleLocales.map(locale => (
                <Line
                  key={locale}
                  type="monotone"
                  dataKey={locale}
                  stroke={localeColor(locale, allLocales)}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: localeColor(locale, allLocales), strokeWidth: 0 }}
                  activeDot={{ r: 7, strokeWidth: 0 }}
                  connectNulls
                  isAnimationActive
                  animationDuration={600}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Grouped bar chart: latest output per locale × workflow ──────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <BarChart2 className="w-4 h-4 text-brand-500 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Locale comparison</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Most recent saved projection per locale / workflow combination
            </p>
          </div>
        </div>

        {barData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
            <BarChart2 className="w-8 h-8 text-slate-200" />
            <p className="text-xs text-slate-400">No data matches the current workflow filter.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="locale"
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={v => (v as number) >= 1000 ? `${Math.round((v as number) / 1000)}k` : String(v)}
              />
              <Tooltip content={<BarTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
              />
              {(workflowFilter === 'All' ? availableWorkflows : [workflowFilter]).map(wf => (
                <Bar
                  key={wf}
                  dataKey={wf}
                  fill={workflowColor(wf)}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={52}
                  isAnimationActive
                  animationDuration={600}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  )
}

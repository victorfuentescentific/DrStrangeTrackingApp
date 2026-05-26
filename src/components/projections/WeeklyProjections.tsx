'use client'

import { useMemo, useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { formatDate, cn } from '@/lib/utils'
import {
  computeProjection, sumWeeklyOutput, workingDaysRemainingThisWeek, weekStart,
  PHASE_LABEL, ProductionUnit, WorksetProjection,
} from '@/lib/projections'
import { TIER2_LOCALES } from '@/lib/eta-calculator'
import { format, addDays } from 'date-fns'
import { Users, TrendingUp, Clock, AlertTriangle } from 'lucide-react'

const UNIT_LABEL: Record<ProductionUnit, string> = {
  'min audio': 'min audio',
  'rep':       'rep',
  'WU':        'WU',
}

const PHASE_COLOR: Record<string, string> = {
  [PHASE_LABEL.P1]:      'bg-blue-100 text-blue-700',
  [PHASE_LABEL.P2]:      'bg-orange-100 text-orange-700',
  [PHASE_LABEL.P2_PHI1]: 'bg-orange-100 text-orange-700',
  [PHASE_LABEL.PHI]:     'bg-green-100 text-green-700',
  [PHASE_LABEL.PHI1]:    'bg-green-100 text-green-700',
  [PHASE_LABEL.PHI2]:    'bg-green-100 text-green-700',
}

function SummaryCard({ label, value, unit, sub }: { label: string; value: number; unit: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">
        {value.toLocaleString()}
        <span className="text-sm font-medium text-slate-400 ml-1.5">{unit}</span>
      </p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function PhaseTag({ label }: { label: string }) {
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', PHASE_COLOR[label] ?? 'bg-slate-100 text-slate-500')}>
      {label}
    </span>
  )
}

function DaysBar({ daysToFinish, daysLeft }: { daysToFinish: number; daysLeft: number }) {
  if (daysToFinish === 0) return <span className="text-[10px] text-green-600 font-medium">Completes this week</span>
  const overWeek = daysToFinish > daysLeft
  return (
    <span className={cn('text-[10px] font-medium', overWeek ? 'text-amber-600' : 'text-green-600')}>
      {daysToFinish}d to complete
      {overWeek && ' ▸ continues next week'}
    </span>
  )
}

export function WeeklyProjections() {
  const { worksets } = useStore()
  const today     = new Date()
  const todayStr  = format(today, 'yyyy-MM-dd')
  const daysLeft  = workingDaysRemainingThisWeek(today)
  const monDate   = weekStart(today)
  const friDate   = addDays(monDate, 4)

  // HC overrides: worksetId → string (editable input)
  // Persisted to localStorage so overrides survive tab switches and page reloads.
  const [hcOverrides, setHcOverrides] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('dr-strange-hc-overrides')
      return stored ? (JSON.parse(stored) as Record<string, string>) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try { localStorage.setItem('dr-strange-hc-overrides', JSON.stringify(hcOverrides)) }
    catch { /* localStorage unavailable (SSR, incognito quota) */ }
  }, [hcOverrides])

  const active = useMemo(
    () => worksets.filter(w => w.status !== 'completed' && w.startDate && w.eta),
    [worksets],
  )

  const projections = useMemo((): WorksetProjection[] =>
    active.map(ws => {
      const override = hcOverrides[ws.id] !== undefined ? parseInt(hcOverrides[ws.id]) || ws.teamSize : undefined
      return computeProjection(ws, todayStr, override)
    }),
  [active, todayStr, hcOverrides])

  const running = useMemo(() => projections.filter(p => !p.isIdle), [projections])
  const idle    = useMemo(() => projections.filter(p => p.isIdle),  [projections])
  const totals  = useMemo(() => sumWeeklyOutput(running), [running])

  return (
    <div className="space-y-6">

      {/* Week header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            Week of {format(monDate, 'dd MMM')} – {format(friDate, 'dd MMM yyyy')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {daysLeft} working day{daysLeft !== 1 ? 's' : ''} remaining this week
            {daysLeft <= 1 && <span className="text-amber-600 font-medium ml-1">(Today is Friday)</span>}
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-400">
          {running.length} active phase{running.length !== 1 ? 's' : ''} · {idle.length} idle
        </div>
      </div>

      {/* Summary totals */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          label="Transcription output"
          value={totals['min audio']}
          unit="min audio"
          sub="DAX + DMO 1P and 2P combined"
        />
        <SummaryCard
          label="Scribing output"
          value={totals['rep']}
          unit="rep"
          sub="Scribing 1P and 2P combined"
        />
        <SummaryCard
          label="PHI throughput"
          value={totals['WU']}
          unit="WU"
          sub="PHI Ph.1 + Ph.2 combined"
        />
      </div>

      {/* Active worksets table */}
      {running.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-semibold text-slate-700">Active production</span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-48">Workset</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-24">Locale</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-36">Phase</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-20">
                  <span className="flex items-center justify-center gap-1"><Users className="w-3 h-3" />HC</span>
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-32">Rate / day</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-28">Daily output</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-16">Days</th>
                <th className="text-right px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Week proj.</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Phase status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {running.map(proj => {
                const ws   = proj.workset
                const rows = proj.phaseRows
                const isTier2 = TIER2_LOCALES.includes(ws.locale)

                return rows.map((row, ri) => (
                  <tr key={`${ws.id}-${ri}`} className={cn(
                    'hover:bg-slate-50 transition-colors',
                    ri > 0 ? 'border-t-0' : '',
                  )}>
                    {/* Workset name — only in first sub-row */}
                    {ri === 0 ? (
                      <td className="px-5 py-3" rowSpan={rows.length}>
                        <div>
                          <p className="text-xs font-semibold text-slate-700 truncate max-w-[170px]">{ws.name}</p>
                          <p className="text-[10px] text-slate-400">{ws.worksetId} · {ws.workflow}</p>
                          {isTier2 && (
                            <span className="text-[9px] text-amber-600 flex items-center gap-0.5 mt-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />Tier 2 (4h/day)
                            </span>
                          )}
                        </div>
                      </td>
                    ) : null}

                    {/* Locale — only in first sub-row */}
                    {ri === 0 ? (
                      <td className="px-3 py-3" rowSpan={rows.length}>
                        <span className="text-xs font-mono text-slate-600">{ws.locale}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">N={ws.teamSize}</p>
                      </td>
                    ) : null}

                    {/* Phase badge */}
                    <td className="px-3 py-2">
                      <PhaseTag label={row.phase} />
                    </td>

                    {/* HC — editable only on first sub-row; 2P always fixed at 4 */}
                    <td className="px-3 py-2 text-center">
                      {row.phase === '2P' ? (
                        <span className="text-xs text-slate-500">4 <span className="text-[9px] text-slate-300">(fixed)</span></span>
                      ) : ri === 0 ? (
                        <input
                          type="number"
                          min={1} max={50}
                          value={hcOverrides[ws.id] ?? ws.teamSize}
                          onChange={e => setHcOverrides(prev => ({ ...prev, [ws.id]: e.target.value }))}
                          className="w-14 px-2 py-1 text-xs text-center border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-400"
                        />
                      ) : (
                        <span className="text-xs text-slate-600">{row.hc}</span>
                      )}
                    </td>

                    {/* Rate per person */}
                    <td className="px-3 py-2 text-right">
                      <span className="text-xs text-slate-600">{row.rate}</span>
                      <span className="text-[10px] text-slate-400 ml-1">{UNIT_LABEL[row.unit]}/p</span>
                    </td>

                    {/* Daily output */}
                    <td className="px-3 py-2 text-right">
                      <span className="text-xs font-semibold text-slate-700">{row.output.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 ml-1">{UNIT_LABEL[row.unit]}</span>
                    </td>

                    {/* Days remaining — only in first sub-row */}
                    {ri === 0 ? (
                      <td className="px-3 py-2 text-center" rowSpan={rows.length}>
                        <span className="text-xs font-semibold text-slate-700">{proj.daysLeft}</span>
                      </td>
                    ) : null}

                    {/* Weekly projection */}
                    <td className="px-5 py-2 text-right">
                      <span className="text-sm font-bold text-slate-800">{(row.output * proj.daysLeft).toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 ml-1">{UNIT_LABEL[row.unit]}</span>
                    </td>

                    {/* Phase completion status */}
                    <td className="px-3 py-2">
                      <DaysBar daysToFinish={row.daysToFinish} daysLeft={proj.daysLeft} />
                      {row.corpusRemaining > 0 && (
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          ~{row.corpusRemaining.toLocaleString()} {UNIT_LABEL[row.unit]} remaining
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              })}
            </tbody>

            {/* Per-phase totals footer */}
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              {(['min audio', 'rep', 'WU'] as ProductionUnit[]).filter(u => totals[u] > 0).map(unit => (
                <tr key={unit}>
                  <td colSpan={7} className="px-5 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Total {UNIT_LABEL[unit]} this week
                  </td>
                  <td className="px-5 py-2 text-right">
                    <span className="text-sm font-bold text-brand-600">{totals[unit].toLocaleString()}</span>
                    <span className="text-[11px] text-slate-400 ml-1">{UNIT_LABEL[unit]}</span>
                  </td>
                  <td />
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      )}

      {/* Idle / gate worksets */}
      {idle.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-500">Idle / gate this week</span>
          </div>
          <div className="divide-y divide-slate-50">
            {idle.map(proj => (
              <div key={proj.workset.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-600 truncate">{proj.workset.name}</p>
                  <p className="text-[10px] text-slate-400">{proj.workset.locale} · {proj.workset.workflow}</p>
                </div>
                <span className="text-[11px] text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                  {proj.phaseLabel}
                </span>
                {proj.workset.phases && (
                  <p className="text-[11px] text-slate-400">
                    ETA {formatDate(proj.workset.revisedEta ?? proj.workset.eta)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {running.length === 0 && idle.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <p className="text-slate-400">No active worksets this week.</p>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        * Corpus remaining is estimated from days elapsed in phase × daily rate — actual progress not tracked.
        HC override applies to all phases of that workset except the fixed 2P team (always 4).
      </p>
    </div>
  )
}

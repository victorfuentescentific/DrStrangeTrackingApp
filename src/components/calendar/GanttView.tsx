'use client'

import { useMemo, useState } from 'react'
import { Workset, PhaseTimeline } from '@/lib/types'
import { formatDate, cn } from '@/lib/utils'
import { WORKFLOW_COLORS, PHASE_HEX, adjustPhaseDate, calculateETA } from '@/lib/eta-calculator'
import { useStore } from '@/lib/store'
import { differenceInCalendarDays, parseISO, addDays, format } from 'date-fns'
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'

interface GanttViewProps {
  worksets: Workset[]
}

const PHASE_META = [
  { key: 'p1',  label: '1P+IAA', color: PHASE_HEX.p1  },
  { key: 'rev', label: 'REV',    color: PHASE_HEX.rev  },
  { key: 'p2',  label: '2P',     color: PHASE_HEX.p2   },
  { key: 'phi', label: 'PHI',    color: PHASE_HEX.phi  },
]

const LABEL_WIDTH = 260

const DAY_LABELS = ['S', 'M', 'T', 'W', 'TH', 'F', 'S'] as const

function getPhaseSegments(ws: Workset, spanStart: Date): Array<{ left: number; width: number; color: string; label: string }> {
  if (!ws.phases) return []
  const p     = ws.phases
  const total = differenceInCalendarDays(parseISO(p.etaDate), parseISO(ws.startDate)) + 1 || 1
  const segs  = [
    { start: ws.startDate, end: p.p1End,   color: PHASE_HEX.p1,  label: '1P+IAA' },
    { start: p.rev1End,    end: p.rev1End, color: PHASE_HEX.rev, label: 'REV'    },
    { start: p.p2Start,    end: p.p2End,   color: PHASE_HEX.p2,  label: '2P'     },
    { start: p.phiStart,   end: p.etaDate, color: PHASE_HEX.phi, label: 'PHI'    },
  ]
  return segs.map(s => {
    const segStart = differenceInCalendarDays(parseISO(s.start), spanStart)
    const segLen   = differenceInCalendarDays(parseISO(s.end), parseISO(s.start)) + 1
    return { left: (segStart / total) * 100, width: (segLen / total) * 100, color: s.color, label: s.label }
  })
}

function PhaseEditorColumn({
  field, label, color, helperText, phases, onEdit,
}: {
  field: 'p1End' | 'p2End' | 'etaDate'
  label: string
  color: string
  helperText: string
  phases: PhaseTimeline
  onEdit: (field: 'p1End' | 'p2End' | 'etaDate', date: string) => void
}) {
  const value = phases[field]
  return (
    <div>
      <label className="block text-[10px] font-semibold mb-1 flex items-center gap-1" style={{ color }}>
        <span className="w-2 h-2 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: color }} />
        {label}
      </label>
      <input
        type="date"
        defaultValue={value}
        key={value}
        onBlur={e => onEdit(field, e.target.value)}
        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
      />
      <p className="text-[9px] text-slate-400 mt-0.5">{formatDate(value)}</p>
      <p className="text-[9px] text-slate-400">{helperText}</p>
    </div>
  )
}

export function GanttView({ worksets }: GanttViewProps) {
  const { updateWorkset } = useStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const active = useMemo(
    () => worksets.filter(w => w.status !== 'completed' && w.startDate && w.eta),
    [worksets],
  )

  const { spanStart, spanDays, tickDates } = useMemo(() => {
    if (active.length === 0) {
      const today = new Date()
      return {
        spanStart: today,
        spanDays: 60,
        tickDates: Array.from({ length: 9 }, (_, i) => addDays(today, i * 7)),
      }
    }
    const starts = active.flatMap(w => {
      const dates = [parseISO(w.startDate)]
      if (w.phases?.headStart) dates.push(parseISO(w.phases.headStart.headStartBegin))
      return dates
    })
    const ends    = active.map(w => parseISO(w.revisedEta ?? w.eta))
    const minDate = new Date(Math.min(...starts.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...ends.map(d => d.getTime())))
    const spanDays = differenceInCalendarDays(maxDate, minDate) + 14
    const tickCount = Math.ceil(spanDays / 7) + 1
    return {
      spanStart: minDate,
      spanDays,
      tickDates: Array.from({ length: tickCount }, (_, i) => addDays(minDate, i * 7)),
    }
  }, [active])

  // Must be before early return — hooks cannot be called conditionally
  const dayColumns = useMemo(() => (
    Array.from({ length: spanDays }, (_, i) => {
      const d   = addDays(spanStart, i)
      const dow = d.getDay()
      return {
        i, dow,
        label:     DAY_LABELS[dow],
        pct:       (i / spanDays) * 100,
        w:         (1 / spanDays) * 100,
        isWeekend: dow === 0 || dow === 6,
        isMonday:  dow === 1,
      }
    })
  ), [spanStart, spanDays])

  if (active.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
        <p className="text-slate-400">No active worksets to display.</p>
        <p className="text-slate-400 text-sm mt-1">Create worksets to see the Gantt chart.</p>
      </div>
    )
  }

  const today       = new Date()
  const todayOffset = (differenceInCalendarDays(today, spanStart) / spanDays) * 100

  function handlePhaseEdit(ws: Workset, field: 'p1End' | 'p2End' | 'etaDate', newDate: string) {
    if (!ws.phases || !newDate) return
    const adjusted = adjustPhaseDate(ws.phases, field, newDate)
    updateWorkset(ws.id, { phases: adjusted, eta: adjusted.etaDate })
  }

  function handleReset(ws: Workset) {
    if (!ws.phases) return
    const fresh = calculateETA(ws.workflow, ws.locale, ws.teamSize, ws.startDate)
    updateWorkset(ws.id, { phases: fresh, eta: fresh.etaDate })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

      {/* Header */}
      <div style={{ marginLeft: LABEL_WIDTH }}>

        {/* Row 1 — week labels */}
        <div className="relative h-6 bg-slate-50 border-b border-slate-100">
          {dayColumns.map(col => col.isWeekend && (
            <div key={col.i} className="absolute top-0 bottom-0 bg-slate-200/40"
              style={{ left: `${col.pct}%`, width: `${col.w}%` }} />
          ))}
          {tickDates.map((d, i) => {
            const pct = (differenceInCalendarDays(d, spanStart) / spanDays) * 100
            if (pct < 0 || pct > 100) return null
            return (
              <div key={i} className="absolute top-0 bottom-0 flex items-center" style={{ left: `${pct}%` }}>
                <div className="h-full border-l border-slate-300" />
                <span className="text-[10px] text-slate-500 ml-1 whitespace-nowrap font-medium">
                  {format(d, 'dd MMM')}
                </span>
              </div>
            )
          })}
        </div>

        {/* Row 2 — day-of-week labels */}
        <div className="relative h-5 border-b border-slate-200 bg-slate-50">
          {dayColumns.map(col => (
            <div
              key={col.i}
              className={cn(
                'absolute top-0 bottom-0 flex items-center justify-center',
                col.isWeekend ? 'bg-slate-200/40' : '',
                col.isMonday ? 'border-l border-slate-300' : 'border-l border-slate-100',
              )}
              style={{ left: `${col.pct}%`, width: `${col.w}%` }}
            >
              <span className={cn(
                'text-[8px] leading-none font-medium select-none',
                col.isWeekend ? 'text-slate-300' : 'text-slate-400',
              )}>
                {col.label}
              </span>
            </div>
          ))}
        </div>

      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {active.map(ws => {
          const start    = parseISO(ws.startDate)
          const end      = parseISO(ws.revisedEta ?? ws.eta)
          const leftPct  = (differenceInCalendarDays(start, spanStart) / spanDays) * 100
          const widthPct = ((differenceInCalendarDays(end, start) + 1) / spanDays) * 100
          const segs     = getPhaseSegments(ws, spanStart)
          const isExpanded = expandedId === ws.id
          const p        = ws.phases
          const hs       = p?.headStart

          return (
            <div key={ws.id}>
              {/* Main bar row */}
              <div
                className="flex items-center h-12 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : ws.id)}
              >
                <div className="flex-shrink-0 px-4 flex items-center gap-2" style={{ width: LABEL_WIDTH }}>
                  <span className="text-slate-300 flex-shrink-0">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{ws.name}</p>
                    <p className="text-[10px] text-slate-400">{ws.locale} · {ws.workflow}</p>
                  </div>
                </div>

                <div className="flex-1 relative h-8 px-2">
                  {dayColumns.map(col => (
                    <div key={col.i} className={cn(
                      'absolute top-0 bottom-0',
                      col.isWeekend ? 'bg-slate-100/60' : '',
                      col.isMonday  ? 'border-l border-slate-200' : '',
                    )} style={{ left: `${col.pct}%`, width: `${col.w}%` }} />
                  ))}

                  {todayOffset >= 0 && todayOffset <= 100 && (
                    <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10" style={{ left: `${todayOffset}%` }} />
                  )}

                  {hs && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-5 rounded-sm border border-dashed border-blue-300 z-10"
                      title={`Head start: ${(hs.headStartPct * 100).toFixed(1)}% of 1P+IAA pre-completed`}
                      style={{ left: `${Math.max(0, (differenceInCalendarDays(parseISO(hs.headStartBegin), spanStart) / spanDays) * 100)}%`, width: `${((differenceInCalendarDays(parseISO(hs.headStartEnd), parseISO(hs.headStartBegin)) + 1) / spanDays) * 100}%`, backgroundColor: '#bfdbfe', opacity: 0.7 }}
                    />
                  )}

                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-5 rounded-full opacity-20"
                    style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.min(widthPct, 100 - Math.max(0, leftPct))}%`, backgroundColor: WORKFLOW_COLORS[ws.workflow] }}
                  />

                  {segs.length > 0 ? segs.map((seg, i) => (
                    <div key={i} className="absolute top-1/2 -translate-y-1/2 h-5 rounded-sm" title={seg.label}
                      style={{ left: `${Math.max(0, leftPct + (seg.left / 100) * widthPct)}%`, width: `${(seg.width / 100) * widthPct}%`, backgroundColor: seg.color, opacity: 0.85 }} />
                  )) : (
                    <div className="absolute top-1/2 -translate-y-1/2 h-5 rounded-full"
                      style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.min(widthPct, 100 - Math.max(0, leftPct))}%`, backgroundColor: WORKFLOW_COLORS[ws.workflow], opacity: 0.7 }} />
                  )}

                  <div className="absolute top-1/2 -translate-y-1/2 text-[9px] font-medium text-slate-600 whitespace-nowrap"
                    style={{ left: `${Math.min(leftPct + widthPct + 0.5, 96)}%` }}>
                    {formatDate(ws.revisedEta ?? ws.eta)}
                    {ws.revisedEta && <span className="text-amber-500 ml-0.5">↑</span>}
                  </div>
                </div>
              </div>

              {/* Expanded phase editor */}
              {isExpanded && p && (
                <div className="flex border-t border-slate-100 bg-blue-50/30" onClick={e => e.stopPropagation()}>
                  <div className="flex-shrink-0 px-4 py-3" style={{ width: LABEL_WIDTH }}>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Phase dates</p>
                  </div>
                  <div className="flex-1 px-4 py-3">
                    <div className="grid grid-cols-3 gap-4">
                      <PhaseEditorColumn field="p1End"   label="1P+IAA ends"   color={PHASE_HEX.p1}  helperText="Shifts 2P + PHI"    phases={p} onEdit={(f, d) => handlePhaseEdit(ws, f, d)} />
                      <PhaseEditorColumn field="p2End"   label="2P ends"       color={PHASE_HEX.p2}  helperText="Shifts PHI / ETA"   phases={p} onEdit={(f, d) => handlePhaseEdit(ws, f, d)} />
                      <PhaseEditorColumn field="etaDate" label="PHI ends / ETA" color={PHASE_HEX.phi} helperText="PHI phase length only" phases={p} onEdit={(f, d) => handlePhaseEdit(ws, f, d)} />
                    </div>
                    <button type="button" onClick={() => handleReset(ws)}
                      className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
                      <RotateCcw className="w-3 h-3" />
                      Reset to model calculation
                    </button>
                  </div>
                </div>
              )}

              {isExpanded && !p && (
                <div className="flex border-t border-slate-100 bg-slate-50/50">
                  <div className="flex-shrink-0" style={{ width: LABEL_WIDTH }} />
                  <div className="px-4 py-3 text-[11px] text-slate-400">
                    No phase data — set an ETA and locale to enable phase editing.
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-5 flex-wrap bg-slate-50">
        {PHASE_META.map(p => (
          <div key={p.key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color, opacity: 0.85 }} />
            <span className="text-[10px] text-slate-500">{p.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-px h-3 bg-red-400" />
          <span className="text-[10px] text-slate-500">Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-amber-500 text-[10px]">↑</span>
          <span className="text-[10px] text-slate-500">Revised ETA</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm border border-dashed border-blue-300" style={{ backgroundColor: '#bfdbfe', opacity: 0.7 }} />
          <span className="text-[10px] text-slate-500">Head start (Set 2 pre-work)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] text-slate-500">Click row to edit phases</span>
        </div>
      </div>
    </div>
  )
}

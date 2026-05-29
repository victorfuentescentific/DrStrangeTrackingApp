'use client'

import { useMemo, useState } from 'react'
import { Workset, PhaseTimeline } from '@/lib/types'
import { formatDate, cn } from '@/lib/utils'
import { calculateETA } from '@/lib/eta-calculator'
import { getLocaleColor, PHASE_PATTERN_STYLE, PHASE_LEGEND, type PhaseKey } from '@/lib/locale-colors'
import { EditablePhaseKey } from '@/lib/types'
import { useStore } from '@/lib/store'
import { differenceInCalendarDays, parseISO, addDays, format } from 'date-fns'
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { PhaseTimelineEditor } from '@/components/worksets/PhaseTimelineEditor'

interface GanttViewProps {
  worksets: Workset[]
}


const LABEL_WIDTH = 260

const DAY_LABELS = ['S', 'M', 'T', 'W', 'TH', 'F', 'S'] as const

type GanttSeg = { left: number; width: number; phaseKey: PhaseKey; label: string }

// Map EditablePhaseKey → visual PhaseKey (two REV gates share the same colour/pattern)
const VISUAL_KEY: Record<EditablePhaseKey, PhaseKey> = {
  p1:   'p1',
  rev1: 'rev',
  p2:   'p2',
  rev2: 'rev',
  phi:  'phi',
}

const ALL_SEGS: Array<{ key: EditablePhaseKey; start: (p: NonNullable<Workset['phases']>, ws: Workset) => string; end: (p: NonNullable<Workset['phases']>) => string; label: string }> = [
  { key: 'p1',   start: (_, ws) => ws.startDate, end: p => p.p1End,   label: '1P+IAA' },
  { key: 'rev1', start: p => p.p1End,             end: p => p.rev1End, label: 'REV₁'  },
  { key: 'p2',   start: p => p.p2Start,           end: p => p.p2End,   label: '2P'    },
  { key: 'rev2', start: p => p.p2End,             end: p => p.rev2End, label: 'REV₂'  },
  { key: 'phi',  start: p => p.phiStart,          end: p => p.etaDate, label: 'PHI'   },
]

function getPhaseSegments(ws: Workset): GanttSeg[] {
  if (!ws.phases) return []
  const p       = ws.phases
  const active  = new Set<EditablePhaseKey>(p.activePhases ?? ['p1', 'rev1', 'p2', 'rev2', 'phi'])
  const wsStart = parseISO(ws.startDate)
  const total   = differenceInCalendarDays(parseISO(p.etaDate), wsStart) + 1 || 1

  return ALL_SEGS
    .filter(s => active.has(s.key))
    .map(s => {
      const sDate = s.start(p, ws)
      const eDate = s.end(p)
      const segOffset = differenceInCalendarDays(parseISO(sDate), wsStart)
      const segLen    = differenceInCalendarDays(parseISO(eDate), parseISO(sDate)) + 1
      return { left: (segOffset / total) * 100, width: (segLen / total) * 100, phaseKey: VISUAL_KEY[s.key], label: s.label }
    })
}

export function GanttView({ worksets }: GanttViewProps) {
  const { updateWorkset } = useStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const active = useMemo(
    () => worksets.filter(w => w.startDate && w.eta),
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

  function getDefaultTimeline(ws: Workset) {
    return calculateETA(ws.workflow, ws.locale, ws.teamSize, ws.startDate)
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
          const segs     = getPhaseSegments(ws)
          const locColor = getLocaleColor(ws.locale)
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{ws.name}</p>
                      {ws.phases?.isCustom && (
                        <span title="Custom Timeline" className="flex-shrink-0 text-amber-500">
                          <Pencil className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
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

                  {/* Continuous spine — locale color, low opacity */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full"
                    style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.min(widthPct, 100 - Math.max(0, leftPct))}%`, backgroundColor: locColor, opacity: 0.25 }}
                  />

                  {/* Phase segments — locale color base + phase texture */}
                  {segs.length > 0 ? segs.map((seg, i) => (
                    <div key={i} className="absolute top-1/2 -translate-y-1/2 h-5 rounded-sm"
                      title={`${ws.locale} · ${ws.workflow} — ${seg.label}`}
                      style={{
                        left:            `${Math.max(0, leftPct + (seg.left / 100) * widthPct)}%`,
                        width:           `${Math.max(0.4, (seg.width / 100) * widthPct)}%`,
                        backgroundColor: locColor,
                        opacity:         0.88,
                        ...PHASE_PATTERN_STYLE[seg.phaseKey],
                      }} />
                  )) : (
                    <div className="absolute top-1/2 -translate-y-1/2 h-5 rounded-full"
                      style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.min(widthPct, 100 - Math.max(0, leftPct))}%`, backgroundColor: locColor, opacity: 0.80 }} />
                  )}

                  {/* Locale · workflow badge */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 text-[8px] font-semibold text-white bg-black/30 px-1 py-0.5 rounded-sm whitespace-nowrap pointer-events-none z-10"
                    style={{ left: `${Math.max(0, leftPct) + 0.3}%` }}
                  >
                    {ws.locale} · {ws.workflow}
                  </div>

                  <div className="absolute top-1/2 -translate-y-1/2 text-[9px] font-medium text-slate-600 whitespace-nowrap"
                    style={{ left: `${Math.min(leftPct + widthPct + 0.5, 96)}%` }}>
                    {formatDate(ws.revisedEta ?? ws.eta)}
                    {ws.revisedEta && <span className="text-amber-500 ml-0.5">↑</span>}
                  </div>
                </div>
              </div>

              {/* Expanded phase editor */}
              {isExpanded && p && (
                <div className="flex border-t border-slate-100 bg-slate-50/40" onClick={e => e.stopPropagation()}>
                  <div className="flex-shrink-0" style={{ width: LABEL_WIDTH }} />
                  <div className="flex-1 px-4 py-3">
                    <PhaseTimelineEditor
                      defaultTimeline={getDefaultTimeline(ws)}
                      currentTimeline={p}
                      startDate={ws.startDate}
                      onChange={next => updateWorkset(ws.id, { phases: next, eta: next.etaDate })}
                    />
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
        {/* Phase texture legend */}
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Phases</span>
        {PHASE_LEGEND.map(ph => (
          <div key={ph.key} className="flex items-center gap-1.5">
            <div
              className="w-6 h-3 rounded-sm border border-slate-300/50"
              style={{ backgroundColor: '#6366f1', ...PHASE_PATTERN_STYLE[ph.key], opacity: 0.88 }}
            />
            <span className="text-[10px] text-slate-500">{ph.label}</span>
          </div>
        ))}
        <div className="w-px h-3 bg-slate-300" />
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
          <span className="text-[10px] text-slate-500">Head start</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] text-slate-500">Click row to edit phase timeline</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Pencil className="w-3 h-3 text-amber-500" />
          <span className="text-[10px] text-slate-500">Custom Timeline</span>
        </div>
      </div>
    </div>
  )
}

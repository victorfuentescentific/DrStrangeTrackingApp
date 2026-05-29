'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Workset } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getLocaleColor, PHASE_PATTERN_STYLE, PHASE_LABEL, PHASE_LEGEND, type PhaseKey } from '@/lib/locale-colors'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, parseISO,
  format, isSameMonth, differenceInCalendarDays,
} from 'date-fns'

interface CalendarMonthViewProps {
  worksets: Workset[]
}

// ─── Layout constants ────────────────────────────────────────────────────────
const DATE_ROW_H = 28   // px for date-number row at top of each week
const BAR_H      = 20   // px height per event lane
const BAR_GAP    = 2    // px gap between stacked lanes
const MAX_LANES  = 3    // lanes shown before "+N more"

// ─── Phase segment definition ────────────────────────────────────────────────
type PhaseDef = { phase: PhaseKey; startDate: string; endDate: string }

function getWorksetPhases(ws: Workset): PhaseDef[] {
  if (!ws.phases) {
    // No phase data → treat entire span as PHI (solid)
    return [{ phase: 'phi', startDate: ws.startDate, endDate: ws.revisedEta ?? ws.eta }]
  }
  const p      = ws.phases
  const active = new Set(p.activePhases ?? ['p1', 'rev1', 'p2', 'rev2', 'phi'])

  // Full 5-segment list — keys aligned with EditablePhaseKey order
  const all: Array<{ key: string; def: PhaseDef }> = [
    { key: 'p1',   def: { phase: 'p1',  startDate: p.p1Start,  endDate: p.p1End   } },
    { key: 'rev1', def: { phase: 'rev', startDate: p.p1End,    endDate: p.rev1End  } },
    { key: 'p2',   def: { phase: 'p2',  startDate: p.p2Start,  endDate: p.p2End   } },
    { key: 'rev2', def: { phase: 'rev', startDate: p.p2End,    endDate: p.rev2End  } },
    { key: 'phi',  def: { phase: 'phi', startDate: p.phiStart, endDate: p.etaDate  } },
  ]
  return all.filter(s => active.has(s.key)).map(s => s.def)
}

// ─── Per-week data structures ────────────────────────────────────────────────
type WeekPhaseSlice = {
  phase:        PhaseKey
  startCol:     number   // 0–6 within the week
  endCol:       number
  isPhaseStart: boolean  // phase actually starts in this week
  isPhaseEnd:   boolean  // phase actually ends in this week
}

type WorksetWeekBar = {
  ws:             Workset
  localeColor:    string
  lane:           number
  isWorksetStart: boolean  // ws.startDate falls in this week
  isWorksetEnd:   boolean  // ws eta falls in this week
  phases:         WeekPhaseSlice[]  // phase slices visible in this week
}

function getBarsForWeek(weekStart: Date, weekEnd: Date, worksets: Workset[]): WorksetWeekBar[] {
  const raw: Array<Omit<WorksetWeekBar, 'lane'>> = []

  for (const ws of worksets) {
    if (!ws.startDate || !ws.eta) continue

    const wsStart = parseISO(ws.startDate)
    const wsEnd   = parseISO(ws.revisedEta ?? ws.eta)
    if (wsStart > weekEnd || wsEnd < weekStart) continue

    // Compute phase slices that overlap this week
    const phaseDefs = getWorksetPhases(ws)
    const phaseSlices: WeekPhaseSlice[] = []

    for (const def of phaseDefs) {
      const pStart = parseISO(def.startDate)
      const pEnd   = parseISO(def.endDate)
      if (pStart > weekEnd || pEnd < weekStart) continue

      const clampStart = pStart < weekStart ? weekStart : pStart
      const clampEnd   = pEnd   > weekEnd   ? weekEnd   : pEnd

      phaseSlices.push({
        phase:        def.phase,
        startCol:     differenceInCalendarDays(clampStart, weekStart),
        endCol:       differenceInCalendarDays(clampEnd,   weekStart),
        isPhaseStart: pStart >= weekStart,
        isPhaseEnd:   pEnd   <= weekEnd,
      })
    }

    // Fallback: if no phase slices resolved, show whole workset span as phi
    if (phaseSlices.length === 0) {
      const clampStart = wsStart < weekStart ? weekStart : wsStart
      const clampEnd   = wsEnd   > weekEnd   ? weekEnd   : wsEnd
      phaseSlices.push({
        phase:        'phi',
        startCol:     differenceInCalendarDays(clampStart, weekStart),
        endCol:       differenceInCalendarDays(clampEnd,   weekStart),
        isPhaseStart: wsStart >= weekStart,
        isPhaseEnd:   wsEnd   <= weekEnd,
      })
    }

    raw.push({
      ws,
      localeColor:    getLocaleColor(ws.locale),
      isWorksetStart: wsStart >= weekStart,
      isWorksetEnd:   wsEnd   <= weekEnd,
      phases:         phaseSlices,
    })
  }

  // Greedy lane assignment — sort by leftmost column then name
  const sorted = [...raw].sort((a, b) => {
    const ac = a.phases[0]?.startCol ?? 0
    const bc = b.phases[0]?.startCol ?? 0
    return ac - bc || a.ws.name.localeCompare(b.ws.name)
  })

  const laneEndCol: number[] = []
  for (const item of sorted) {
    const firstCol = item.phases[0]?.startCol ?? 0
    const lastCol  = item.phases[item.phases.length - 1]?.endCol ?? 6
    let lane = laneEndCol.findIndex(end => end < firstCol)
    if (lane === -1) lane = laneEndCol.length
    laneEndCol[lane] = lastCol
    ;(item as WorksetWeekBar).lane = lane
  }

  return sorted as WorksetWeekBar[]
}

// ─── Component ───────────────────────────────────────────────────────────────
export function CalendarMonthView({ worksets }: CalendarMonthViewProps) {
  const [current, setCurrent] = useState(new Date())

  const weeks = useMemo<Date[][]>(() => {
    const monthStart = startOfMonth(current)
    const monthEnd   = endOfMonth(current)
    const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 })

    const result: Date[][] = []
    let d = calStart
    while (d <= calEnd) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) week.push(addDays(d, i))
      result.push(week)
      d = addDays(d, 7)
    }
    return result
  }, [current])

  const today = new Date()

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

      {/* Month navigation */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <button
          onClick={() => setCurrent(subMonths(current, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        <h2 className="text-sm font-semibold text-slate-800">
          {format(current, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrent(addMonths(current, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            {day}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="divide-y divide-slate-100">
        {weeks.map((week, wi) => {
          const weekStart   = week[0]
          const weekEnd     = week[6]
          const bars        = getBarsForWeek(weekStart, weekEnd, worksets)
          const visible     = bars.filter(b => b.lane < MAX_LANES)
          const hiddenCount = bars.length - visible.length
          const rowH        = DATE_ROW_H + MAX_LANES * (BAR_H + BAR_GAP) + (hiddenCount > 0 ? 16 : 6)

          return (
            <div
              key={wi}
              className="relative grid grid-cols-7 divide-x divide-slate-100"
              style={{ height: rowH }}
            >
              {/* Day cell backgrounds + date numbers */}
              {week.map((day, di) => {
                const isToday        = isSameDay(day, today)
                const isCurrentMonth = isSameMonth(day, current)
                const isWeekend      = day.getDay() === 0 || day.getDay() === 6

                return (
                  <div
                    key={di}
                    className={cn(
                      'pt-1.5 px-1.5',
                      !isCurrentMonth && 'bg-slate-50/50',
                      isWeekend && isCurrentMonth && 'bg-slate-50/30',
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium',
                      isToday
                        ? 'bg-brand-500 text-white'
                        : isCurrentMonth ? 'text-slate-700' : 'text-slate-300',
                    )}>
                      {format(day, 'd')}
                    </div>
                  </div>
                )
              })}

              {/* Workset phase bars */}
              {visible.map(bar => {
                const top             = DATE_ROW_H + bar.lane * (BAR_H + BAR_GAP)
                const phaseCount      = bar.phases.length
                const firstPhaseIdx   = 0
                const lastPhaseIdx    = phaseCount - 1
                // Show label on the very first phase segment (leftmost in this week)
                const labelText       = bar.isWorksetStart ? `${bar.ws.name} · ${bar.ws.locale}` : ''

                return bar.phases.map((seg, si) => {
                  const leftPct  = (seg.startCol / 7) * 100
                  const widthPct = ((seg.endCol - seg.startCol + 1) / 7) * 100
                  const isFirst  = si === firstPhaseIdx && bar.isWorksetStart
                  const isLast   = si === lastPhaseIdx  && bar.isWorksetEnd
                  const borderRadius = isFirst && isLast ? '6px'
                    : isFirst ? '6px 0 0 6px'
                    : isLast  ? '0 6px 6px 0'
                    : '0'

                  const customTag  = bar.ws.phases?.isCustom ? ' ✏ Custom Timeline' : ''
                  const phaseTitle = `${bar.ws.name} · ${bar.ws.locale} · ${bar.ws.workflow} — ${PHASE_LABEL[seg.phase]}${customTag}`

                  return (
                    <div
                      key={`${bar.ws.id}-${seg.phase}`}
                      title={phaseTitle}
                      className="absolute flex items-center overflow-hidden cursor-default select-none"
                      style={{
                        top,
                        left:            `calc(${leftPct}% + 1px)`,
                        width:           `calc(${widthPct}% - 2px)`,
                        height:          BAR_H,
                        backgroundColor: bar.localeColor,
                        borderRadius,
                        opacity:         0.84,
                        ...PHASE_PATTERN_STYLE[seg.phase],
                      }}
                    >
                      {si === 0 && labelText && (
                        <span className="text-[9px] text-white font-semibold truncate px-1.5 leading-none drop-shadow-sm">
                          {labelText}
                        </span>
                      )}
                    </div>
                  )
                })
              })}

              {/* "+N more" overflow */}
              {hiddenCount > 0 && (
                <div
                  className="absolute text-[9px] text-slate-400 font-medium"
                  style={{ bottom: 3, left: 6 }}
                >
                  +{hiddenCount} more
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-6 flex-wrap bg-slate-50">
        {/* Phase texture legend */}
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Phases</span>
          {PHASE_LEGEND.map(p => (
            <div key={p.key} className="flex items-center gap-1.5">
              <div
                className="w-8 h-3 rounded-sm border border-slate-300/50"
                style={{
                  backgroundColor: '#6366f1',
                  ...PHASE_PATTERN_STYLE[p.key],
                  opacity: 0.9,
                }}
              />
              <span className="text-[10px] text-slate-500">{p.label}</span>
            </div>
          ))}
        </div>
        <div className="w-px h-4 bg-slate-200" />
        {/* Today indicator */}
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">●</span>
          </div>
          <span className="text-[10px] text-slate-500">Today</span>
        </div>
      </div>
    </div>
  )
}

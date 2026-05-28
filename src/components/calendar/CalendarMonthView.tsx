'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Workset } from '@/lib/types'
import { cn } from '@/lib/utils'
import { WORKFLOW_COLORS } from '@/lib/eta-calculator'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, parseISO,
  format, isSameMonth, differenceInCalendarDays,
} from 'date-fns'

interface CalendarMonthViewProps {
  worksets: Workset[]
}

// ─── Layout constants ────────────────────────────────────────────────────────
const DATE_ROW_H  = 28  // px for the date-number strip at top of each week row
const BAR_H       = 20  // px tall per event bar
const BAR_GAP     = 2   // px gap between stacked bars
const MAX_LANES   = 3   // max bars shown before "+N more"

// ─── Lane assignment ─────────────────────────────────────────────────────────
type WeekBar = {
  ws:       Workset
  color:    string
  startCol: number   // 0-6 column where bar starts within this week
  span:     number   // how many columns it occupies in this week
  isFirst:  boolean  // ws actually starts in this week (show name label)
  isLast:   boolean  // ws actually ends in this week (right-rounded)
  lane:     number   // vertical row index (0-based)
}

function assignLanes(bars: WeekBar[]): WeekBar[] {
  // Sort left-to-right so earlier bars grab lower lanes first
  const sorted = [...bars].sort((a, b) => a.startCol - b.startCol || a.ws.name.localeCompare(b.ws.name))
  const laneEndCol: number[] = []   // last occupied column per lane

  for (const bar of sorted) {
    let lane = laneEndCol.findIndex(end => end < bar.startCol)
    if (lane === -1) {
      lane = laneEndCol.length
    }
    laneEndCol[lane] = bar.startCol + bar.span - 1
    bar.lane = lane
  }
  return sorted
}

// ─── Per-week bar builder ────────────────────────────────────────────────────
function getBarsForWeek(weekStart: Date, weekEnd: Date, worksets: Workset[]): WeekBar[] {
  const raw: Omit<WeekBar, 'lane'>[] = []

  for (const ws of worksets) {
    if (ws.status === 'completed' || !ws.startDate || !ws.eta) continue

    const wsStart = parseISO(ws.startDate)
    const wsEnd   = parseISO(ws.revisedEta ?? ws.eta)

    // No overlap with this week?
    if (wsStart > weekEnd || wsEnd < weekStart) continue

    const clampStart = wsStart < weekStart ? weekStart : wsStart
    const clampEnd   = wsEnd   > weekEnd   ? weekEnd   : wsEnd

    const startCol = differenceInCalendarDays(clampStart, weekStart)
    const endCol   = differenceInCalendarDays(clampEnd,   weekStart)

    raw.push({
      ws,
      color:    WORKFLOW_COLORS[ws.workflow] ?? '#6366f1',
      startCol,
      span:     endCol - startCol + 1,
      isFirst:  wsStart >= weekStart,
      isLast:   wsEnd   <= weekEnd,
      lane:     0,
    })
  }

  return assignLanes(raw as WeekBar[])
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
          <div
            key={day}
            className="py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wide"
          >
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

              {/* Continuous event bars */}
              {visible.map((bar, bi) => {
                const top      = DATE_ROW_H + bar.lane * (BAR_H + BAR_GAP)
                const leftPct  = (bar.startCol / 7) * 100
                const widthPct = (bar.span      / 7) * 100

                // Label only on the first visible segment of this bar
                const label = bar.isFirst
                  ? `${bar.ws.name} · ${bar.ws.locale}`
                  : ''

                const etaStr   = format(parseISO(bar.ws.revisedEta ?? bar.ws.eta), 'dd MMM')
                const startStr = format(parseISO(bar.ws.startDate), 'dd MMM')
                const tooltip  = `${bar.ws.name} (${bar.ws.locale}) · ${bar.ws.workflow}\n${startStr} → ${etaStr}${bar.ws.revisedEta ? ' (revised)' : ''}`

                return (
                  <div
                    key={`${bar.ws.id}-${bi}`}
                    title={tooltip}
                    className={cn(
                      'absolute flex items-center overflow-hidden cursor-default select-none',
                      // Left rounded only at workset start; right rounded only at workset end
                      bar.isFirst  ? 'rounded-l-md' : '',
                      bar.isLast   ? 'rounded-r-md' : '',
                      // Tiny left indent on continuations so the edge bleeds slightly
                      !bar.isFirst ? 'pl-0' : 'pl-1.5',
                    )}
                    style={{
                      top,
                      // 1px inset on each side so adjacent week borders stay visible
                      left:            `calc(${leftPct}% + 1px)`,
                      width:           `calc(${widthPct}% - 2px)`,
                      height:          BAR_H,
                      backgroundColor: bar.color,
                      opacity:         0.82,
                    }}
                  >
                    {label && (
                      <span className="text-[9px] text-white font-semibold truncate leading-none">
                        {label}
                      </span>
                    )}
                  </div>
                )
              })}

              {/* Overflow indicator */}
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
      <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-5 flex-wrap bg-slate-50">
        {(['DAX', 'DMO', 'Scribing'] as const).map(wf => (
          <div key={wf} className="flex items-center gap-1.5">
            <div
              className="w-5 h-3 rounded-sm"
              style={{ backgroundColor: WORKFLOW_COLORS[wf], opacity: 0.82 }}
            />
            <span className="text-[10px] text-slate-500">{wf}</span>
          </div>
        ))}
        <div className="ml-2 flex items-center gap-1.5">
          <div className="w-5 h-3 rounded-sm bg-brand-500" />
          <span className="text-[10px] text-slate-500">Today</span>
        </div>
      </div>
    </div>
  )
}

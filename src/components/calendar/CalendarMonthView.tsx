'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Workset } from '@/lib/types'
import { cn } from '@/lib/utils'
import { WORKFLOW_COLORS } from '@/lib/eta-calculator'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, parseISO,
  format, isSameMonth,
} from 'date-fns'

interface CalendarMonthViewProps {
  worksets: Workset[]
}

type DayEvent = {
  worksetId: string
  name: string
  locale: string
  workflow: string
  type: 'eta' | 'p2-start' | 'phi-start' | 'start'
  color: string
}

function buildEventMap(worksets: Workset[]): Map<string, DayEvent[]> {
  const map = new Map<string, DayEvent[]>()

  const push = (dateStr: string, evt: DayEvent) => {
    const key = dateStr
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(evt)
  }

  for (const ws of worksets) {
    if (ws.status === 'completed') continue
    const base = { worksetId: ws.worksetId, name: ws.name, locale: ws.locale, workflow: ws.workflow }
    const wfColor = WORKFLOW_COLORS[ws.workflow as keyof typeof WORKFLOW_COLORS] ?? '#6366f1'

    // Start date
    if (ws.startDate) push(ws.startDate, { ...base, type: 'start', color: '#94a3b8' })

    // ETA (revised takes priority)
    const etaDate = ws.revisedEta ?? ws.eta
    if (etaDate) push(etaDate, { ...base, type: 'eta', color: wfColor })

    // Phase milestones
    if (ws.phases) {
      push(ws.phases.p2Start,  { ...base, type: 'p2-start',  color: '#f97316' })
      push(ws.phases.phiStart, { ...base, type: 'phi-start', color: '#22c55e' })
    }
  }

  return map
}

const TYPE_LABELS: Record<DayEvent['type'], string> = {
  'eta':       'ETA',
  'p2-start':  '2P',
  'phi-start': 'PHI',
  'start':     'Start',
}

const TYPE_BG: Record<DayEvent['type'], string> = {
  'eta':       'bg-indigo-500',
  'p2-start':  'bg-orange-500',
  'phi-start': 'bg-green-500',
  'start':     'bg-slate-400',
}

export function CalendarMonthView({ worksets }: CalendarMonthViewProps) {
  const [current, setCurrent] = useState(new Date())
  const eventMap = useMemo(() => buildEventMap(worksets), [worksets])

  const monthStart  = startOfMonth(current)
  const monthEnd    = endOfMonth(current)
  const calStart    = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd      = endOfWeek(monthEnd,    { weekStartsOn: 1 })

  const days: Date[] = []
  let d = calStart
  while (d <= calEnd) {
    days.push(d)
    d = addDays(d, 1)
  }

  const today = new Date()

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
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

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 divide-x divide-slate-100">
        {days.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd')
          const events = eventMap.get(key) ?? []
          const isToday = isSameDay(day, today)
          const isCurrentMonth = isSameMonth(day, current)
          const isWeekend = day.getDay() === 0 || day.getDay() === 6

          return (
            <div
              key={idx}
              className={cn(
                'min-h-[90px] p-1.5 border-b border-slate-100',
                !isCurrentMonth && 'bg-slate-50/50',
                isWeekend && isCurrentMonth && 'bg-slate-50/30',
              )}
            >
              <div className={cn(
                'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1',
                isToday ? 'bg-brand-500 text-white' : isCurrentMonth ? 'text-slate-700' : 'text-slate-300',
              )}>
                {format(day, 'd')}
              </div>

              <div className="space-y-0.5">
                {events.slice(0, 3).map((evt, i) => (
                  <div
                    key={i}
                    title={`${evt.name} (${evt.locale}) — ${TYPE_LABELS[evt.type]}`}
                    className={cn(
                      'text-[9px] text-white font-medium px-1 py-0.5 rounded truncate',
                      TYPE_BG[evt.type],
                    )}
                  >
                    {TYPE_LABELS[evt.type]}: {evt.locale}
                  </div>
                ))}
                {events.length > 3 && (
                  <div className="text-[9px] text-slate-400 pl-1">+{events.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-5 flex-wrap bg-slate-50">
        {(Object.entries(TYPE_LABELS) as [DayEvent['type'], string][]).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded-sm', TYPE_BG[type])} />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

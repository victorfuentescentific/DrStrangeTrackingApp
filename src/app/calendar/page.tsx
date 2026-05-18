'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { GanttView } from '@/components/calendar/GanttView'
import { CalendarMonthView } from '@/components/calendar/CalendarMonthView'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { BarChart2, CalendarDays } from 'lucide-react'

type ViewMode = 'gantt' | 'month'

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('gantt')
  const worksets = useStore(s => s.worksets)

  return (
    <AppLayout title="Calendar" subtitle="Visual timeline of workset phases and ETA milestones">
      <div className="space-y-4">
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          <button
            onClick={() => setView('gantt')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              view === 'gantt'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <BarChart2 className="w-4 h-4" />
            Gantt
          </button>
          <button
            onClick={() => setView('month')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              view === 'month'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <CalendarDays className="w-4 h-4" />
            Monthly
          </button>
        </div>

        {view === 'gantt' ? (
          <GanttView worksets={worksets} />
        ) : (
          <CalendarMonthView worksets={worksets} />
        )}
      </div>
    </AppLayout>
  )
}

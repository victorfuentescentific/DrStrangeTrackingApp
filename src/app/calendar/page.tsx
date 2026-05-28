'use client'

import { useState, useMemo } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { GanttView } from '@/components/calendar/GanttView'
import { CalendarMonthView } from '@/components/calendar/CalendarMonthView'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { getLocaleColor } from '@/lib/locale-colors'
import { BarChart2, CalendarDays, SlidersHorizontal, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Workset } from '@/lib/types'

type ViewMode = 'gantt' | 'month'

// ─── Filter Sidebar ───────────────────────────────────────────────────────────

function FilterSidebar({
  worksets,
  selectedLocales,
  setSelectedLocales,
  selectedWorksets,
  setSelectedWorksets,
  onClose,
}: {
  worksets: Workset[]
  selectedLocales: Set<string>
  setSelectedLocales: (s: Set<string>) => void
  selectedWorksets: Set<string>
  setSelectedWorksets: (s: Set<string>) => void
  onClose: () => void
}) {
  const [localeOpen,   setLocaleOpen]   = useState(true)
  const [worksetOpen,  setWorksetOpen]  = useState(true)

  const allLocales  = useMemo(() => [...new Set(worksets.map(w => w.locale))].sort(), [worksets])
  const activeWs    = useMemo(() => worksets.filter(w => w.status !== 'completed'), [worksets])

  const toggleLocale = (loc: string) => {
    const next = new Set(selectedLocales)
    next.has(loc) ? next.delete(loc) : next.add(loc)
    setSelectedLocales(next)
  }

  const toggleWorkset = (id: string) => {
    const next = new Set(selectedWorksets)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedWorksets(next)
  }

  const activeCount = selectedLocales.size + selectedWorksets.size

  return (
    <aside className="flex-shrink-0 w-56 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col self-start sticky top-4">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700">Filters</span>
          {activeCount > 0 && (
            <span className="text-[10px] font-bold bg-brand-500 text-white rounded-full px-1.5 py-0.5 leading-none">
              {activeCount}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-slate-100 text-slate-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {/* ── Locale section ── */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => setLocaleOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <span>Locale</span>
            <div className="flex items-center gap-1">
              {selectedLocales.size > 0 && (
                <span
                  className="text-[9px] text-brand-600 font-bold cursor-pointer hover:text-red-500"
                  onClick={e => { e.stopPropagation(); setSelectedLocales(new Set()) }}
                  title="Clear locale filter"
                >
                  ✕ clear
                </span>
              )}
              {localeOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </div>
          </button>

          {localeOpen && (
            <div className="px-3 pb-2 space-y-1">
              {allLocales.map(loc => {
                const checked = selectedLocales.has(loc)
                return (
                  <label key={loc} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLocale(loc)}
                      className="rounded border-slate-300 text-brand-500 focus:ring-brand-400 w-3.5 h-3.5"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getLocaleColor(loc) }}
                    />
                    <span className={cn(
                      'text-[11px] font-mono',
                      checked ? 'text-slate-800 font-semibold' : 'text-slate-500 group-hover:text-slate-700',
                    )}>
                      {loc}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Workset section ── */}
        <div>
          <button
            onClick={() => setWorksetOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <span>Workset</span>
            <div className="flex items-center gap-1">
              {selectedWorksets.size > 0 && (
                <span
                  className="text-[9px] text-brand-600 font-bold cursor-pointer hover:text-red-500"
                  onClick={e => { e.stopPropagation(); setSelectedWorksets(new Set()) }}
                  title="Clear workset filter"
                >
                  ✕ clear
                </span>
              )}
              {worksetOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </div>
          </button>

          {worksetOpen && (
            <div className="px-3 pb-3 space-y-1">
              {activeWs.map(ws => {
                const checked = selectedWorksets.has(ws.id)
                return (
                  <label key={ws.id} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleWorkset(ws.id)}
                      className="rounded border-slate-300 text-brand-500 focus:ring-brand-400 w-3.5 h-3.5 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className={cn(
                        'text-[10px] leading-tight truncate',
                        checked ? 'text-slate-800 font-semibold' : 'text-slate-500 group-hover:text-slate-700',
                      )}>
                        {ws.name}
                      </p>
                      <p className="text-[9px] text-slate-400 font-mono">{ws.worksetId}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [view, setView]       = useState<ViewMode>('gantt')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [selectedLocales,  setSelectedLocales]  = useState<Set<string>>(new Set())
  const [selectedWorksets, setSelectedWorksets] = useState<Set<string>>(new Set())

  const worksets = useStore(s => s.worksets)

  const filteredWorksets = useMemo(() => {
    let result = worksets
    if (selectedLocales.size  > 0) result = result.filter(w => selectedLocales.has(w.locale))
    if (selectedWorksets.size > 0) result = result.filter(w => selectedWorksets.has(w.id))
    return result
  }, [worksets, selectedLocales, selectedWorksets])

  const activeFilterCount = selectedLocales.size + selectedWorksets.size

  return (
    <AppLayout title="Calendar" subtitle="Visual timeline of workset phases and ETA milestones">
      <div className="space-y-4">
        {/* View toggle + filter toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            <button
              onClick={() => setView('gantt')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                view === 'gantt' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <BarChart2 className="w-4 h-4" />
              Gantt
            </button>
            <button
              onClick={() => setView('month')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                view === 'month' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <CalendarDays className="w-4 h-4" />
              Monthly
            </button>
          </div>

          {/* Filter toggle button (when sidebar is closed) */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="text-[10px] font-bold bg-brand-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Sidebar + view */}
        <div className="flex gap-4 items-start">
          {sidebarOpen && (
            <FilterSidebar
              worksets={worksets}
              selectedLocales={selectedLocales}
              setSelectedLocales={setSelectedLocales}
              selectedWorksets={selectedWorksets}
              setSelectedWorksets={setSelectedWorksets}
              onClose={() => setSidebarOpen(false)}
            />
          )}

          <div className="flex-1 min-w-0">
            {view === 'gantt' ? (
              <GanttView worksets={filteredWorksets} />
            ) : (
              <CalendarMonthView worksets={filteredWorksets} />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

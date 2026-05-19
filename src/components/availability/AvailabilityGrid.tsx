'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { DayForm } from './DayForm'
import { type AvailabilitySubmission, type AvailabilityStatus, STATUS_CONFIG } from '@/lib/availability-types'

interface AvailabilityGridProps {
  userId: string
  employeeType: string | null
  locale: string | null
  workflow: string | null
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function isWeekend(date: Date) {
  const d = date.getDay()
  return d === 0 || d === 6
}

export function AvailabilityGrid({ userId, employeeType, locale, workflow }: AvailabilityGridProps) {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [submissions, setSubmissions] = useState<AvailabilitySubmission[]>([])
  const [loading, setLoading]         = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalOpen, setModalOpen]       = useState(false)

  const fetchMonth = useCallback(async (y: number, m: number) => {
    setLoading(true)
    const from = isoDate(y, m, 1)
    const lastDay = new Date(y, m + 1, 0).getDate()
    const to   = isoDate(y, m, lastDay)
    try {
      const res  = await fetch(`/api/availability?userId=${userId}&from=${from}&to=${to}`)
      const data = await res.json()
      setSubmissions(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Load on mount and month change
  useState(() => { fetchMonth(year, month) })

  function prevMonth() {
    const newMonth = month === 0 ? 11 : month - 1
    const newYear  = month === 0 ? year - 1 : year
    setYear(newYear); setMonth(newMonth)
    fetchMonth(newYear, newMonth)
  }

  function nextMonth() {
    const newMonth = month === 11 ? 0 : month + 1
    const newYear  = month === 11 ? year + 1 : year
    setYear(newYear); setMonth(newMonth)
    fetchMonth(newYear, newMonth)
  }

  const submissionMap = Object.fromEntries(submissions.map(s => [s.date, s]))

  // Build calendar days
  const firstDay  = new Date(year, month, 1)
  const lastDay   = new Date(year, month + 1, 0)
  const startDow  = (firstDay.getDay() + 6) % 7  // Monday = 0
  const totalDays = lastDay.getDate()

  const cells: Array<{ date: string; day: number } | null> = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => ({
      day: i + 1,
      date: isoDate(year, month, i + 1),
    })),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = new Date(year, month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const todayStr   = today.toISOString().slice(0, 10)

  function openDay(date: string) {
    const dow = new Date(date + 'T12:00:00Z').getUTCDay()
    if (dow === 0 || dow === 6) return
    setSelectedDate(date)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    fetchMonth(year, month)
  }

  const selected = selectedDate ? submissionMap[selectedDate] : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{monthLabel}</h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(STATUS_CONFIG) as [AvailabilityStatus, typeof STATUS_CONFIG[AvailabilityStatus]][]).map(([code, cfg]) => (
          <span key={code} className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
        ))}
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}

        {/* Calendar cells */}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />

          const sub     = submissionMap[cell.date]
          const isToday = cell.date === todayStr
          const weekend = isWeekend(new Date(cell.date + 'T12:00:00Z'))
          const isPast  = cell.date < todayStr

          return (
            <button
              key={cell.date}
              onClick={() => openDay(cell.date)}
              disabled={weekend}
              className={`
                relative min-h-[72px] p-1.5 rounded-xl border text-left transition-all
                ${weekend ? 'bg-gray-50 border-gray-100 cursor-default' : 'hover:border-blue-300 hover:shadow-sm cursor-pointer'}
                ${isToday ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-100'}
                ${sub ? 'bg-white' : weekend ? '' : 'bg-white'}
                ${isPast && !sub && !weekend ? 'bg-amber-50 border-amber-100' : ''}
              `}
            >
              {/* Day number */}
              <span className={`text-xs font-semibold ${
                isToday ? 'text-blue-600' : weekend ? 'text-gray-300' : 'text-gray-500'
              }`}>
                {cell.day}
              </span>

              {/* Status content */}
              {sub && (
                <div className="mt-1">
                  <StatusBadge
                    status={sub.status}
                    employeeType={employeeType}
                    hours={sub.availabilityHours}
                    size="sm"
                  />
                  {sub.estimatedStartCet && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{sub.estimatedStartCet.slice(0,5)} CET</p>
                  )}
                </div>
              )}

              {/* Empty weekday — show + icon on hover */}
              {!sub && !weekend && (
                <div className="mt-1 opacity-0 group-hover:opacity-100">
                  <Plus className="w-3 h-3 text-gray-300" />
                </div>
              )}

              {/* Missing indicator */}
              {!sub && !weekend && isPast && (
                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="text-center py-4 text-sm text-gray-400">Loading…</div>
      )}

      {/* Day form modal */}
      {modalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {selected ? 'Edit availability' : 'Submit availability'}
            </h3>
            <DayForm
              date={selectedDate}
              userId={userId}
              employeeType={employeeType}
              locale={locale}
              workflow={workflow}
              existing={selected ? {
                status: selected.status,
                availabilityHours: selected.availabilityHours,
                estimatedStartCet: selected.estimatedStartCet,
                notes: selected.notes,
              } : null}
              onSaved={handleSaved}
              onCancel={() => setModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

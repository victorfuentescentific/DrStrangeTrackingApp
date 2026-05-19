'use client'

import { useState } from 'react'
import { FTE_ONLY_STATUSES, STATUS_CONFIG, type AvailabilityStatus } from '@/lib/availability-types'

const VALID_STATUSES_LIST: AvailabilityStatus[] = [
  'AVAILABLE','PTO','BH','NO','SL','WA','UL','DH','PATERNITY','OTHER',
]
const VALID_HOURS = [0, 2, 4, 6, 8, 10, 12]
const START_TIMES = [
  '07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00',
]

interface DayFormProps {
  date: string           // YYYY-MM-DD
  userId: string
  employeeType: string | null
  locale: string | null
  workflow: string | null
  existing?: {
    status: AvailabilityStatus
    availabilityHours: number | null
    estimatedStartCet: string | null
    notes: string
  } | null
  onSaved: () => void
  onCancel: () => void
}

export function DayForm({
  date, userId, employeeType, locale, workflow, existing, onSaved, onCancel,
}: DayFormProps) {
  const isFreelancer = employeeType === 'FREELANCER'

  const [status, setStatus]         = useState<AvailabilityStatus>(existing?.status ?? 'AVAILABLE')
  const [hours, setHours]           = useState<number>(existing?.availabilityHours ?? 8)
  const [startTime, setStartTime]   = useState(existing?.estimatedStartCet?.slice(0, 5) ?? '09:00')
  const [notes, setNotes]           = useState(existing?.notes ?? '')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const availableStatuses = VALID_STATUSES_LIST.filter(
    s => !isFreelancer || !FTE_ONLY_STATUSES.includes(s)
  )
  const needsHours     = status === 'AVAILABLE' || status === 'WA'
  const needsStartTime = needsHours && hours > 0

  const displayDate = new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          date,
          status,
          availabilityHours: needsHours ? hours : null,
          estimatedStartCet: needsStartTime ? startTime : null,
          locale,
          workflow,
          notes,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.details?.join(', ') ?? data.error ?? 'Failed to save')
        return
      }

      onSaved()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">Date</p>
        <p className="text-base font-semibold text-gray-900">{displayDate}</p>
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <div className="flex flex-wrap gap-2">
          {availableStatuses.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                status === s
                  ? 'border-blue-500 ring-2 ring-blue-300 ' + STATUS_CONFIG[s].color
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Hours — only when AVAILABLE or WA */}
      {needsHours && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Availability hours
          </label>
          <div className="flex gap-2">
            {VALID_HOURS.map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(h)}
                className={`w-10 h-10 rounded-lg text-sm font-semibold border transition-all ${
                  hours === h
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Start time — only when hours > 0 */}
      {needsStartTime && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estimated start (CET)
          </label>
          <select
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="block w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {START_TIMES.map(t => (
              <option key={t} value={t}>{t} CET</option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder={status === 'SL' ? 'e.g. 2h sick leave in the afternoon' : ''}
          className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : existing ? 'Update' : 'Submit'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

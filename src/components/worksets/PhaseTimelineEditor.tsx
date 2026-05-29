'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, RotateCcw, Pencil, GripVertical } from 'lucide-react'
import { PhaseTimeline, EditablePhaseKey, EDITABLE_PHASE_KEYS, PHASE_META } from '@/lib/types'
import {
  CustomPhaseInput,
  buildCustomTimeline,
  extractPhaseDurations,
  addWorkingDays,
  countWorkingDays,
  isWorkingDay,
} from '@/lib/eta-calculator'
import { cn, formatDate } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

// Given a phase list and startDate, compute the start date of a specific phase
function phaseStartDate(phases: CustomPhaseInput[], idx: number, startDate: string): string {
  let offset = 0
  for (let i = 0; i < idx; i++) offset += phases[i].days
  return addWorkingDays(startDate, offset)
}

// Given a phase list and startDate, compute the end date of a specific phase
function phaseEndDate(phases: CustomPhaseInput[], idx: number, startDate: string): string {
  let offset = 0
  for (let i = 0; i <= idx; i++) offset += phases[i].days
  return addWorkingDays(startDate, offset - 1)
}

// Nearest Monday-or-later working day from a date string
function nearestWorkingDay(dateStr: string): string {
  if (!dateStr) return dateStr
  const d = new Date(dateStr + 'T12:00:00')
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// ─── PhaseRow ─────────────────────────────────────────────────────────────────

interface PhaseRowProps {
  phase:        CustomPhaseInput
  idx:          number
  startDate:    string
  allPhases:    CustomPhaseInput[]
  canDelete:    boolean
  onChangeDays: (idx: number, days: number) => void
  onChangeEnd:  (idx: number, endDate: string) => void
  onDelete:     (idx: number) => void
}

function PhaseRow({ phase, idx, startDate, allPhases, canDelete, onChangeDays, onChangeEnd, onDelete }: PhaseRowProps) {
  const meta    = PHASE_META[phase.key]
  const pStart  = phaseStartDate(allPhases, idx, startDate)
  const pEnd    = phaseEndDate(allPhases, idx, startDate)

  // Minimum selectable end date = phase start (1 working day minimum)
  // Maximum = no constraint (we don't cap)
  function handleEndDateChange(raw: string) {
    if (!raw) return
    const clamped = nearestWorkingDay(raw < pStart ? pStart : raw)
    const wd = countWorkingDays(pStart, clamped)
    onChangeEnd(idx, clamped)
    // Days derived from date selection
    if (wd !== phase.days) onChangeDays(idx, Math.max(1, wd))
  }

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-white rounded-lg border border-slate-200 group">
      {/* Drag handle placeholder — visual only */}
      <GripVertical className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />

      {/* Phase colour dot + label */}
      <div className="flex items-center gap-2 w-28 flex-shrink-0">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: meta.color }}
        />
        <span className="text-xs font-semibold text-slate-700 truncate">{meta.label}</span>
      </div>

      {/* Working-days stepper */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => onChangeDays(idx, Math.max(1, phase.days - 1))}
          className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors text-sm leading-none"
        >−</button>
        <input
          type="number"
          min={1}
          value={phase.days}
          onChange={e => onChangeDays(idx, Math.max(1, parseInt(e.target.value) || 1))}
          className="w-12 text-center text-xs border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-brand-400 tabular-nums"
        />
        <button
          type="button"
          onClick={() => onChangeDays(idx, phase.days + 1)}
          className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors text-sm leading-none"
        >+</button>
        <span className="text-[10px] text-slate-400 ml-0.5">days</span>
      </div>

      {/* Date range — end date is editable, weekends snap forward */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-[10px] text-slate-400 flex-shrink-0">ends</span>
        <input
          type="date"
          value={pEnd}
          min={pStart}
          onChange={e => handleEndDateChange(e.target.value)}
          // Disable weekend selection visually via title; snap happens in handler
          title="Weekends snap to next Monday"
          className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
        />
        <span className="text-[10px] text-slate-400 whitespace-nowrap">
          {formatDate(pStart) !== formatDate(pEnd) ? `${formatDate(pStart)} – ${formatDate(pEnd)}` : formatDate(pEnd)}
        </span>
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={() => onDelete(idx)}
        disabled={!canDelete}
        title={canDelete ? `Remove ${meta.label}` : 'At least one phase required'}
        className={cn(
          'flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors',
          canDelete
            ? 'text-slate-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100'
            : 'text-slate-200 cursor-not-allowed',
        )}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── PhaseTimelineEditor ──────────────────────────────────────────────────────

export interface PhaseTimelineEditorProps {
  /** The auto-calculated baseline — used for Reset */
  defaultTimeline: PhaseTimeline
  /** Current phases (may already be custom) */
  currentTimeline: PhaseTimeline
  startDate:       string
  /** Called whenever the user changes anything */
  onChange: (next: PhaseTimeline) => void
}

export function PhaseTimelineEditor({
  defaultTimeline,
  currentTimeline,
  startDate,
  onChange,
}: PhaseTimelineEditorProps) {
  const [phases, setPhases] = useState<CustomPhaseInput[]>(() =>
    extractPhaseDurations(currentTimeline),
  )

  // Re-sync if the parent resets (e.g. workflow change regenerates defaultTimeline)
  useEffect(() => {
    setPhases(extractPhaseDurations(currentTimeline))
  // We only want to re-init when the timeline identity changes (not on every render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTimeline.etaDate, currentTimeline.model])

  const emit = useCallback((next: CustomPhaseInput[]) => {
    const timeline = buildCustomTimeline(next, startDate, currentTimeline.model, currentTimeline.isTier2)
    onChange(timeline)
  }, [startDate, currentTimeline.model, currentTimeline.isTier2, onChange])

  function handleChangeDays(idx: number, days: number) {
    const next = phases.map((p, i) => i === idx ? { ...p, days } : p)
    setPhases(next)
    emit(next)
  }

  function handleChangeEnd(idx: number, endDate: string) {
    const pStart = phaseStartDate(phases, idx, startDate)
    const wd = Math.max(1, countWorkingDays(pStart, endDate))
    handleChangeDays(idx, wd)
  }

  function handleDelete(idx: number) {
    if (phases.length <= 1) return
    const next = phases.filter((_, i) => i !== idx)
    setPhases(next)
    emit(next)
  }

  function handleAdd(key: EditablePhaseKey) {
    // Insert the phase in canonical order
    const insertPos = EDITABLE_PHASE_KEYS.indexOf(key)
    const existingPos = phases.map(p => EDITABLE_PHASE_KEYS.indexOf(p.key))
    let pos = phases.length
    for (let i = 0; i < existingPos.length; i++) {
      if (existingPos[i] > insertPos) { pos = i; break }
    }
    const next = [...phases]
    next.splice(pos, 0, { key, days: 1 })
    setPhases(next)
    emit(next)
  }

  function handleReset() {
    const next = extractPhaseDurations(defaultTimeline)
    setPhases(next)
    // Emit as non-custom (reset = back to default)
    onChange({ ...defaultTimeline, isCustom: false, activePhases: undefined })
  }

  const activeKeys = new Set(phases.map(p => p.key))
  const removedPhases = EDITABLE_PHASE_KEYS.filter(k => !activeKeys.has(k))

  // Compute total working days and final ETA
  const totalDays = phases.reduce((s, p) => s + p.days, 0)
  const etaDate   = addWorkingDays(startDate, totalDays - 1)
  const isCustom  = currentTimeline.isCustom ?? false

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pencil className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Phase Timeline</span>
          {isCustom && (
            <span
              title="This timeline has been manually edited"
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-semibold"
            >
              ✏ Custom Timeline
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset to default
        </button>
      </div>

      {/* Phase rows */}
      <div className="space-y-1.5">
        {phases.map((ph, idx) => (
          <PhaseRow
            key={ph.key}
            phase={ph}
            idx={idx}
            startDate={startDate}
            allPhases={phases}
            canDelete={phases.length > 1}
            onChangeDays={handleChangeDays}
            onChangeEnd={handleChangeEnd}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Footer: add phase + summary */}
      <div className="flex items-center justify-between pt-1">
        {removedPhases.length > 0 ? (
          <div className="relative group/add">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add phase
            </button>
            {/* Dropdown — shown on hover */}
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden hidden group-hover/add:block min-w-[140px]">
              {removedPhases.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleAdd(key)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PHASE_META[key].color }}
                  />
                  {PHASE_META[key].label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400">All phases active</span>
        )}

        <div className="text-[10px] text-slate-500 text-right">
          <span className="font-semibold text-slate-700">{totalDays}</span> working days
          {' · '}ETA <span className="font-semibold text-slate-700">{formatDate(etaDate)}</span>
        </div>
      </div>
    </div>
  )
}

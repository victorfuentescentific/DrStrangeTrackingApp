'use client'

import { useState } from 'react'
import { Workset, PhaseTimeline, PhaseActuals } from '@/lib/types'
import { adjustPhaseDate, calculateETA, EditablePhaseField, PHASE_HEX } from '@/lib/eta-calculator'
import { formatDate, cn } from '@/lib/utils'
import { Edit2, RotateCcw, Save, X } from 'lucide-react'

interface PhaseEditorProps {
  workset:  Workset
  canEdit:  boolean
  onSave:   (phases: PhaseTimeline, actualPhases: PhaseActuals) => void
}

// Phase row definitions — what to show and which fields to edit
const PHASE_ROWS = [
  { label: '1P + IAA',      planStart: 'p1Start',  planEnd: 'p1End',   editField: 'p1End'   as EditablePhaseField, color: PHASE_HEX.p1,  actualStart: 'p1ActualStart',  actualEnd: 'p1ActualEnd'  },
  { label: 'Review 1',      planStart: 'rev1End',  planEnd: 'rev1End', editField: 'rev1End' as EditablePhaseField, color: PHASE_HEX.rev, actualStart: null,              actualEnd: 'rev1ActualEnd' },
  { label: '2P Annotation', planStart: 'p2Start',  planEnd: 'p2End',   editField: 'p2End'   as EditablePhaseField, color: PHASE_HEX.p2,  actualStart: 'p2ActualStart',  actualEnd: 'p2ActualEnd'  },
  { label: 'Review 2',      planStart: 'rev2End',  planEnd: 'rev2End', editField: 'rev2End' as EditablePhaseField, color: PHASE_HEX.rev, actualStart: null,              actualEnd: 'rev2ActualEnd' },
  { label: 'PHI',           planStart: 'phiStart', planEnd: 'etaDate', editField: 'etaDate' as EditablePhaseField, color: PHASE_HEX.phi, actualStart: 'phiActualStart', actualEnd: 'phiActualEnd' },
]

export function PhaseEditor({ workset, canEdit, onSave }: PhaseEditorProps) {
  const phases = workset.phases
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<PhaseTimeline | null>(null)
  const [actuals, setActuals] = useState<PhaseActuals>(workset.actualPhases ?? {})

  if (!phases) {
    return (
      <p className="text-xs text-slate-400 italic">
        No phase data — set a locale and ETA to generate a phase timeline.
      </p>
    )
  }

  const activePlan = draft ?? phases

  function startEdit() {
    setDraft({ ...phases! })
    setIsEditing(true)
  }

  function cancelEdit() {
    setDraft(null)
    setActuals(workset.actualPhases ?? {})
    setIsEditing(false)
  }

  function handlePlanDateChange(field: EditablePhaseField, newDate: string) {
    if (!draft) return
    setDraft(adjustPhaseDate(draft, field, newDate))
  }

  function handleActualChange(field: keyof PhaseActuals, value: string) {
    setActuals(prev => ({ ...prev, [field]: value || undefined }))
  }

  function resetToModel() {
    const recalc = calculateETA(workset.workflow, workset.locale, workset.teamSize, workset.startDate)
    setDraft(recalc)
  }

  function save() {
    if (!draft) return
    onSave(draft, actuals)
    setIsEditing(false)
    setDraft(null)
  }

  return (
    <div className="space-y-3">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="font-semibold uppercase tracking-wide">Plan dates</span>
          <span className="text-slate-200">|</span>
          <span className="font-semibold uppercase tracking-wide">Actuals</span>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button type="button" onClick={resetToModel}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
                <RotateCcw className="w-3 h-3" /> Reset to model
              </button>
              <button type="button" onClick={cancelEdit}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                <X className="w-3 h-3" /> Cancel
              </button>
              <button type="button" onClick={save}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors">
                <Save className="w-3 h-3" /> Save
              </button>
            </>
          ) : canEdit ? (
            <button type="button" onClick={startEdit}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
              <Edit2 className="w-3 h-3" /> Edit plan
            </button>
          ) : null}
        </div>
      </div>

      {/* Phase rows table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[160px_1fr_1fr] gap-0 bg-slate-50 border-b border-slate-200 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <span>Phase</span>
          <span>Plan</span>
          <span>Actual</span>
        </div>

        {PHASE_ROWS.map((row, idx) => {
          const planStart = activePlan[row.planStart as keyof PhaseTimeline] as string
          const planEnd   = activePlan[row.planEnd   as keyof PhaseTimeline] as string
          const actualStartVal = row.actualStart ? (actuals[row.actualStart as keyof PhaseActuals] ?? '') : null
          const actualEndVal   = row.actualEnd   ? (actuals[row.actualEnd   as keyof PhaseActuals] ?? '') : ''

          return (
            <div key={row.label} className={cn(
              'grid grid-cols-[160px_1fr_1fr] gap-0 px-4 py-3 items-center',
              idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white',
              idx < PHASE_ROWS.length - 1 && 'border-b border-slate-100',
            )}>
              {/* Phase label */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                <span className="text-xs font-medium text-slate-700">{row.label}</span>
              </div>

              {/* Plan date */}
              <div className="pr-4">
                {isEditing ? (
                  <input
                    type="date"
                    value={planEnd}
                    onChange={e => handlePlanDateChange(row.editField, e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full max-w-[140px]"
                  />
                ) : (
                  <span className="text-sm text-slate-700">
                    {planStart !== planEnd ? `${formatDate(planStart)} → ${formatDate(planEnd)}` : formatDate(planEnd)}
                  </span>
                )}
              </div>

              {/* Actual dates */}
              <div className="flex items-center gap-2">
                {actualStartVal !== null && (
                  <input
                    type="date"
                    value={actualStartVal}
                    onChange={e => handleActualChange(row.actualStart! as keyof PhaseActuals, e.target.value)}
                    placeholder="Start"
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 w-[130px]"
                  />
                )}
                <input
                  type="date"
                  value={actualEndVal}
                  onChange={e => handleActualChange(row.actualEnd as keyof PhaseActuals, e.target.value)}
                  placeholder="End"
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 w-[130px]"
                />
              </div>
            </div>
          )
        })}
      </div>

      {isEditing && draft && (
        <p className="text-[10px] text-slate-400 flex items-center gap-1">
          Editing plan dates: changing one phase end automatically shifts all downstream phases.
          Actuals are saved independently on every change.
        </p>
      )}
    </div>
  )
}

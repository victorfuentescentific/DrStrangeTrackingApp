'use client'

import { useState } from 'react'
import { Workset, PhaseTimeline, PhaseActuals } from '@/lib/types'
import { calculateETA, PHASE_HEX } from '@/lib/eta-calculator'
import { formatDate, cn } from '@/lib/utils'
import { PhaseTimelineEditor } from './PhaseTimelineEditor'

interface PhaseEditorProps {
  workset:  Workset
  canEdit:  boolean
  onSave:   (phases: PhaseTimeline, actualPhases: PhaseActuals) => void
}

// Actuals rows — plan dates now come from PhaseTimelineEditor
const ACTUAL_ROWS = [
  { label: '1P + IAA',      color: PHASE_HEX.p1,  actualStart: 'p1ActualStart'  as keyof PhaseActuals, actualEnd: 'p1ActualEnd'   as keyof PhaseActuals },
  { label: 'Review 1',      color: PHASE_HEX.rev, actualStart: null,                                     actualEnd: 'rev1ActualEnd' as keyof PhaseActuals },
  { label: '2P Annotation', color: PHASE_HEX.p2,  actualStart: 'p2ActualStart'  as keyof PhaseActuals, actualEnd: 'p2ActualEnd'   as keyof PhaseActuals },
  { label: 'Review 2',      color: PHASE_HEX.rev, actualStart: null,                                     actualEnd: 'rev2ActualEnd' as keyof PhaseActuals },
  { label: 'PHI',           color: PHASE_HEX.phi, actualStart: 'phiActualStart' as keyof PhaseActuals, actualEnd: 'phiActualEnd'  as keyof PhaseActuals },
]

export function PhaseEditor({ workset, canEdit, onSave }: PhaseEditorProps) {
  const phases  = workset.phases
  const [draft,    setDraft]    = useState<PhaseTimeline | null>(null)
  const [actuals,  setActuals]  = useState<PhaseActuals>(workset.actualPhases ?? {})

  if (!phases) {
    return (
      <p className="text-xs text-slate-400 italic">
        No phase data — set a locale and ETA to generate a phase timeline.
      </p>
    )
  }

  const defaultTimeline = calculateETA(workset.workflow, workset.locale, workset.teamSize, workset.startDate)
  const currentTimeline = draft ?? phases

  function handleActualChange(field: keyof PhaseActuals, value: string) {
    const next = { ...actuals, [field]: value || undefined }
    setActuals(next)
    // Actuals save immediately (no explicit Save button needed)
    onSave(currentTimeline, next)
  }

  function handleTimelineChange(next: PhaseTimeline) {
    setDraft(next)
    onSave(next, actuals)
  }

  return (
    <div className="space-y-4">
      {/* Plan timeline — working-days editor */}
      {canEdit ? (
        <PhaseTimelineEditor
          defaultTimeline={defaultTimeline}
          currentTimeline={currentTimeline}
          startDate={workset.startDate}
          onChange={handleTimelineChange}
        />
      ) : (
        // Read-only plan summary for non-editors
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Plan Timeline</p>
          {ACTUAL_ROWS.map(row => {
            const ph = currentTimeline as unknown as Record<string, string>
            return (
              <div key={row.label} className="flex items-center gap-3 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                <span className="w-28 font-medium text-slate-700">{row.label}</span>
                <span className="text-slate-400">{formatDate(ph.etaDate ?? '')}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Actuals grid */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[160px_1fr_1fr] bg-slate-50 border-b border-slate-200 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <span>Phase</span>
          <span>Actual start</span>
          <span>Actual end</span>
        </div>
        {ACTUAL_ROWS.map((row, idx) => (
          <div key={row.label} className={cn(
            'grid grid-cols-[160px_1fr_1fr] px-4 py-3 items-center',
            idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white',
            idx < ACTUAL_ROWS.length - 1 && 'border-b border-slate-100',
          )}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
              <span className="text-xs font-medium text-slate-700">{row.label}</span>
            </div>
            <div className="pr-4">
              {row.actualStart ? (
                <input
                  type="date"
                  value={actuals[row.actualStart] ?? ''}
                  onChange={e => handleActualChange(row.actualStart!, e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full max-w-[140px]"
                />
              ) : <span className="text-xs text-slate-300">—</span>}
            </div>
            <div>
              <input
                type="date"
                value={actuals[row.actualEnd] ?? ''}
                onChange={e => handleActualChange(row.actualEnd, e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full max-w-[140px]"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

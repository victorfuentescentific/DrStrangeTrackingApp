'use client'

import { X } from 'lucide-react'
import { Workset, PhaseTimeline } from '@/lib/types'
import { calculateETA } from '@/lib/eta-calculator'
import { useStore } from '@/lib/store'
import { PhaseTimelineEditor } from './PhaseTimelineEditor'

interface PhaseEditModalProps {
  workset: Workset
  onClose: () => void
}

export function PhaseEditModal({ workset, onClose }: PhaseEditModalProps) {
  const { updateWorkset } = useStore()

  const defaultTimeline = calculateETA(
    workset.workflow,
    workset.locale,
    workset.teamSize,
    workset.startDate,
  )

  const currentTimeline: PhaseTimeline = workset.phases ?? defaultTimeline

  function handleChange(next: PhaseTimeline) {
    updateWorkset(workset.id, { phases: next, eta: next.etaDate })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Edit Phase Timeline</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {workset.name} · {workset.locale} · {workset.workflow}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <PhaseTimelineEditor
          defaultTimeline={defaultTimeline}
          currentTimeline={currentTimeline}
          startDate={workset.startDate}
          onChange={handleChange}
        />

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useStore } from '@/lib/store'
import { WORKFLOW_BG, WORKFLOW_COLORS } from '@/lib/eta-calculator'
import { WorkflowType } from '@/lib/types'
import { cn } from '@/lib/utils'

const WORKFLOWS: WorkflowType[] = ['DAX', 'DMO', 'Scribing']

export function WorkloadChart() {
  const worksets = useStore(s => s.worksets)

  const stats = WORKFLOWS.map(wf => {
    const wws    = worksets.filter(w => w.workflow === wf)
    const active  = wws.filter(w => w.status !== 'completed')
    const overdue = wws.filter(w => w.status === 'overdue')
    const blocked = wws.filter(w => w.isBlocked && w.status !== 'completed')
    return { wf, total: wws.length, active: active.length, overdue: overdue.length, blocked: blocked.length }
  }).filter(s => s.total > 0).sort((a, b) => b.active - a.active)

  const max = Math.max(...stats.map(s => s.active), 1)

  if (stats.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-8 text-center">
        <p className="text-slate-400 text-sm">No worksets yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">Workflow Breakdown</h3>
        <p className="text-xs text-slate-400 mt-0.5">Active worksets per workflow</p>
      </div>
      <div className="px-5 py-4 space-y-4">
        {stats.map(({ wf, active, overdue, blocked, total }) => (
          <div key={wf}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', WORKFLOW_BG[wf])}>
                  {wf}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {overdue > 0 && <span className="text-red-500 font-semibold">{overdue} overdue</span>}
                {blocked > 0 && <span className="text-amber-500">{blocked} blocked</span>}
                <span className="text-slate-500 font-medium">{active}/{total}</span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(active / max) * 100}%`,
                  backgroundColor: overdue > 0 ? '#f87171' : WORKFLOW_COLORS[wf],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

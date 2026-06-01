'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, ArrowUpRight, Trash2, CalendarClock, Layers, X } from 'lucide-react'
import { Workset, PhaseTimeline, PhaseActuals } from '@/lib/types'
import { formatDate, daysUntil, daysLabel, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, getEffectiveRisk, expiryCountdownLabel, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/lib/store'
import { ROLE_PERMISSIONS } from '@/lib/types'
import { WORKFLOW_BG } from '@/lib/eta-calculator'
import { PhaseEditor } from '@/components/worksets/PhaseEditor'

// ─── Column resize hook ───────────────────────────────────────────────────────

type ColKey = 'id' | 'name' | 'workflow' | 'status' | 'priority' | 'eta' | 'expiry' | 'actions'
const COL_DEFAULTS: Record<ColKey, number> = {
  id: 88, name: 240, workflow: 100, status: 110, priority: 90, eta: 130, expiry: 120, actions: 72,
}
const COL_MIN: Record<ColKey, number> = {
  id: 60, name: 120, workflow: 80, status: 80, priority: 70, eta: 100, expiry: 90, actions: 60,
}

function useColResize() {
  const [widths, setWidths] = useState<Record<ColKey, number>>(COL_DEFAULTS)
  const dragRef = useRef<{ col: ColKey; startX: number; startW: number } | null>(null)

  const startResize = useCallback((col: ColKey, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { col, startX: e.clientX, startW: widths[col] }

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const { col: c, startX, startW } = dragRef.current
      const next = Math.max(COL_MIN[c], startW + ev.clientX - startX)
      setWidths(prev => ({ ...prev, [c]: next }))
    }
    function onUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [widths])

  return { widths, startResize }
}

// ─── ResizableTh ─────────────────────────────────────────────────────────────
// flex=true  → column has no fixed width; it stretches to fill remaining space.
//              minWidth = current dragged value so it never collapses below that.
// flex=false → column has an explicit pixel width (all other columns).

function ResizableTh({
  col, width, flex = false, children, startResize,
}: {
  col: ColKey
  width: number
  flex?: boolean
  children?: React.ReactNode
  startResize: (col: ColKey, e: React.MouseEvent) => void
}) {
  return (
    <th
      className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide relative select-none group/th"
      style={flex
        ? { minWidth: width }                      // stretches to fill, min enforced
        : { width, minWidth: COL_MIN[col] }        // fixed pixel width
      }
    >
      {children}
      <div
        onMouseDown={e => startResize(col, e)}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover/th:opacity-100 hover:bg-brand-400/40 transition-opacity z-10"
        title="Drag to resize"
      />
    </th>
  )
}

interface WorksetTableProps {
  worksets: Workset[]
}

export function WorksetTable({ worksets }: WorksetTableProps) {
  const router = useRouter()
  const { deleteWorkset, updateWorkset, currentUser } = useStore()
  const perms = ROLE_PERMISSIONS[currentUser.role]
  const canEditPhases = ['admin', 'pm', 'lead'].includes(currentUser.role)

  // Phase quick-edit modal
  const [phasesFor, setPhasesFor] = useState<Workset | null>(null)

  // Resizable columns
  const { widths, startResize } = useColResize()

  if (worksets.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-slate-500 font-medium">No worksets match your filters</p>
        <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters</p>
      </div>
    )
  }

  return (
    <>
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{
          tableLayout: 'fixed',
          // Allow horizontal scroll only when columns are dragged wider than the container.
          // minWidth = sum of all fixed cols + minimum name col width.
          minWidth: widths.id + widths.workflow + widths.status + widths.priority + widths.eta + widths.expiry + widths.actions + COL_MIN.name,
        }}>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left">
              <ResizableTh col="id"       width={widths.id}       startResize={startResize}>ID</ResizableTh>
              {/* flex=true: name column stretches to fill all remaining space */}
              <ResizableTh col="name"     width={widths.name}     flex startResize={startResize}>Workset</ResizableTh>
              <ResizableTh col="workflow" width={widths.workflow}  startResize={startResize}>Workflow</ResizableTh>
              <ResizableTh col="status"   width={widths.status}   startResize={startResize}>Status</ResizableTh>
              <ResizableTh col="priority" width={widths.priority}  startResize={startResize}>Priority</ResizableTh>
              <ResizableTh col="eta"      width={widths.eta}      startResize={startResize}>ETA</ResizableTh>
              <ResizableTh col="expiry"   width={widths.expiry}   startResize={startResize}>Expiry</ResizableTh>
              <ResizableTh col="actions"  width={widths.actions}  startResize={startResize} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {worksets.map(ws => {
              const effectiveEta = ws.revisedEta ?? ws.eta
              const days = daysUntil(effectiveEta)
              const isUrgent = days < 0 || (days <= 1 && ws.status !== 'completed')
              const isModified = !!ws.revisedEta

              return (
                <tr
                  key={ws.id}
                  onClick={() => router.push(`/worksets/${ws.id}`)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  {/* ID */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {ws.worksetId}
                    </span>
                  </td>

                  {/* Name + locale + inline flags */}
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-slate-800 break-words">{ws.name}</p>
                        {ws.isBlocked && (
                          <span title="Blocked">
                            <Ban className="w-3 h-3 text-red-500 flex-shrink-0" />
                          </span>
                        )}
                        {ws.isEscalated && (
                          <span title="Escalated">
                            <ArrowUpRight className="w-3 h-3 text-orange-500 flex-shrink-0" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{ws.locale} · {ws.region}</p>
                    </div>
                  </td>

                  {/* Workflow */}
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', WORKFLOW_BG[ws.workflow])}>
                      {ws.workflow}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[ws.status]}>{STATUS_LABELS[ws.status]}</Badge>
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-3">
                    <Badge className={PRIORITY_COLORS[ws.priority]} size="sm">
                      {ws.priority.charAt(0).toUpperCase() + ws.priority.slice(1)}
                    </Badge>
                  </td>

                  {/* ETA */}
                  <td className="px-4 py-3">
                    <div>
                      <p className={cn(
                        'text-sm font-medium whitespace-nowrap',
                        isUrgent ? 'text-red-600' : 'text-slate-700',
                      )}>
                        {formatDate(effectiveEta)}
                        {isModified && <span className="ml-1 text-[10px] text-amber-500">(revised)</span>}
                      </p>
                      <p className={cn(
                        'text-[11px]',
                        days < 0 ? 'text-red-500 font-semibold' : days <= 1 ? 'text-amber-500 font-medium' : 'text-slate-400',
                      )}>
                        {ws.status === 'completed' ? '✓ Done' : daysLabel(days)}
                      </p>
                    </div>
                  </td>

                  {/* Expiry */}
                  <td className="px-4 py-3">
                    {ws.expirationDate && ws.status !== 'completed' ? (() => {
                      const dLeft = daysUntil(ws.expirationDate)
                      const effRisk = getEffectiveRisk(ws.riskLevel, ws.expirationDate, ws.status)
                      const colorClass =
                        dLeft < 0      ? 'text-red-600'
                        : dLeft <= 7   ? 'text-red-500'
                        : dLeft <= 14  ? 'text-orange-500'
                        : dLeft <= 30  ? 'text-amber-600'
                        : 'text-slate-500'
                      return (
                        <div className="flex items-center gap-1" title={expiryCountdownLabel(ws.expirationDate)}>
                          <CalendarClock className={cn('w-3.5 h-3.5 flex-shrink-0', colorClass)} />
                          <div>
                            <p className={cn('text-xs font-medium whitespace-nowrap', colorClass)}>
                              {formatDate(ws.expirationDate)}
                            </p>
                            <p className={cn('text-[10px]', colorClass)}>
                              {dLeft < 0
                                ? `${Math.abs(dLeft)}d overdue`
                                : dLeft === 0 ? 'Today'
                                : `${dLeft}d left`}
                              {effRisk !== ws.riskLevel && (
                                <span className="ml-1 opacity-70">↑{effRisk}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      )
                    })() : (
                      <span className="text-[11px] text-slate-300">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {canEditPhases && ws.phases && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPhasesFor(ws)}
                          className="text-slate-400 hover:text-brand-600"
                          title="Edit phases"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {perms.canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete ${ws.worksetId}?`)) deleteWorkset(ws.id)
                          }}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
        <p className="text-xs text-slate-500">{worksets.length} workset{worksets.length !== 1 ? 's' : ''} shown</p>
      </div>
    </div>

    {/* Phase quick-edit modal */}
    {phasesFor && (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-16 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Phase Timeline</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                <span className="font-mono bg-slate-100 px-1 rounded">{phasesFor.worksetId}</span>
                {' · '}{phasesFor.name}
              </p>
            </div>
            <button onClick={() => setPhasesFor(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* PhaseEditor */}
          <div className="overflow-y-auto p-6">
            <PhaseEditor
              workset={phasesFor}
              canEdit={canEditPhases}
              onSave={(newPhases: PhaseTimeline, newActuals: PhaseActuals) => {
                updateWorkset(phasesFor.id, {
                  phases:       newPhases,
                  actualPhases: newActuals,
                  eta:          newPhases.etaDate,
                }, 'Phase timeline edited via worksets table')
                setPhasesFor(null)
              }}
            />
          </div>
        </div>
      </div>
    )}
    </>
  )
}

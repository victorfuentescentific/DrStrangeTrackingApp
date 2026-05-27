'use client'

import { useRouter } from 'next/navigation'
import { Ban, ArrowUpRight, Trash2, CalendarClock } from 'lucide-react'
import { Workset } from '@/lib/types'
import { formatDate, daysUntil, daysLabel, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, getEffectiveRisk, expiryCountdownLabel, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/lib/store'
import { ROLE_PERMISSIONS } from '@/lib/types'
import { WORKFLOW_BG } from '@/lib/eta-calculator'

interface WorksetTableProps {
  worksets: Workset[]
}

export function WorksetTable({ worksets }: WorksetTableProps) {
  const router = useRouter()
  const { deleteWorkset, currentUser } = useStore()
  const perms = ROLE_PERMISSIONS[currentUser.role]

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
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">ID</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Workset</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Workflow</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ETA</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Expiry</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20"></th>
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
                  <td className="px-4 py-3 max-w-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-slate-800 truncate max-w-[180px]">{ws.name}</p>
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
  )
}

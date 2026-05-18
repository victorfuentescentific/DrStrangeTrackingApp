'use client'

import { useRouter } from 'next/navigation'
import { Ban, ArrowUpRight, AlertTriangle, Clock } from 'lucide-react'
import { Workset, WorksetStatus } from '@/lib/types'
import { useStore } from '@/lib/store'
import {
  STATUS_LABELS, STATUS_COLORS, STATUS_DOT,
  daysUntil, daysLabel, formatDateShort, cn,
} from '@/lib/utils'

const COLUMNS: WorksetStatus[] = [
  'not-started', 'in-progress', 'at-risk', 'blocked', 'overdue', 'completed',
]

const COLUMN_BG: Record<WorksetStatus, string> = {
  'not-started': 'bg-slate-50 border-slate-200',
  'in-progress': 'bg-blue-50 border-blue-200',
  'at-risk':     'bg-amber-50 border-amber-200',
  'blocked':     'bg-red-50 border-red-200',
  'completed':   'bg-green-50 border-green-200',
  'overdue':     'bg-red-100 border-red-300',
}

const COLUMN_HEADER: Record<WorksetStatus, string> = {
  'not-started': 'text-slate-600',
  'in-progress': 'text-blue-700',
  'at-risk':     'text-amber-700',
  'blocked':     'text-red-600',
  'completed':   'text-green-700',
  'overdue':     'text-red-800',
}

export function KanbanBoard() {
  const getFilteredWorksets = useStore(s => s.getFilteredWorksets)
  const worksets = getFilteredWorksets()
  const router = useRouter()

  const byStatus: Record<WorksetStatus, Workset[]> = {
    'not-started': [],
    'in-progress': [],
    'at-risk':     [],
    'blocked':     [],
    'overdue':     [],
    'completed':   [],
  }

  worksets.forEach(ws => {
    byStatus[ws.status].push(ws)
  })

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-220px)]">
      {COLUMNS.map(status => {
        const items = byStatus[status]
        return (
          <div key={status} className="flex-shrink-0 w-72">
            {/* Column header */}
            <div className={cn(
              'flex items-center justify-between px-3 py-2.5 rounded-t-xl border border-b-0',
              COLUMN_BG[status],
            )}>
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', STATUS_DOT[status])} />
                <span className={cn('text-sm font-semibold', COLUMN_HEADER[status])}>
                  {STATUS_LABELS[status]}
                </span>
              </div>
              <span className="text-xs text-slate-400 font-medium bg-white px-1.5 py-0.5 rounded-full">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className={cn(
              'min-h-24 rounded-b-xl border p-2 space-y-2',
              COLUMN_BG[status],
            )}>
              {items.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">Empty</div>
              ) : (
                items.map(ws => <KanbanCard key={ws.id} ws={ws} onClick={() => router.push(`/worksets/${ws.id}`)} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({ ws, onClick }: { ws: Workset; onClick: () => void }) {
  const effectiveEta = ws.revisedEta ?? ws.eta
  const days = daysUntil(effectiveEta)
  const isOverdue = days < 0
  const isDueSoon = !isOverdue && days <= 2

  const priorityDot: Record<string, string> = {
    low: 'bg-slate-300', medium: 'bg-blue-400', high: 'bg-orange-400', critical: 'bg-red-500',
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-md hover:border-brand-300 transition-all group"
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-slate-400">{ws.worksetId}</span>
        <div className="flex items-center gap-1">
          {ws.isBlocked && <Ban className="w-3 h-3 text-red-400" />}
          {ws.isEscalated && <ArrowUpRight className="w-3 h-3 text-orange-400" />}
          {(ws.riskLevel === 'high' || ws.riskLevel === 'critical') && ws.status !== 'completed' && (
            <AlertTriangle className="w-3 h-3 text-amber-400" />
          )}
          <div className={cn('w-2 h-2 rounded-full', priorityDot[ws.priority])} title={`Priority: ${ws.priority}`} />
        </div>
      </div>

      {/* Name */}
      <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2 group-hover:text-brand-700">
        {ws.name}
      </p>

      {/* Locale */}
      <p className="text-[11px] text-slate-400 mt-1">{ws.locale} · {ws.team}</p>

      {/* ETA */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1 text-[11px]">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className={cn(
            'font-medium',
            isOverdue ? 'text-red-500' : isDueSoon ? 'text-amber-500' : 'text-slate-500',
          )}>
            {ws.status === 'completed' ? 'Done' : daysLabel(days)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400 font-medium">{ws.region}</span>
        </div>
      </div>
    </div>
  )
}

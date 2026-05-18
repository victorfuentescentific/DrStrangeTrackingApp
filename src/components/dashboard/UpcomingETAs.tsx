'use client'

import { useRouter } from 'next/navigation'
import { Calendar, Ban, ArrowUpRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { daysUntil, formatDate, STATUS_COLORS, STATUS_LABELS, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'

export function UpcomingETAs() {
  const router = useRouter()
  const worksets = useStore(s => s.worksets)

  const upcoming = worksets
    .filter(w => {
      if (w.status === 'completed') return false
      const d = daysUntil(w.revisedEta ?? w.eta)
      return d >= -7 && d <= 7
    })
    .sort((a, b) => {
      const da = daysUntil(a.revisedEta ?? a.eta)
      const db = daysUntil(b.revisedEta ?? b.eta)
      return da - db
    })
    .slice(0, 10)

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-500" />
          <h3 className="font-semibold text-slate-800">Upcoming & Overdue ETAs</h3>
        </div>
        <span className="text-xs text-slate-400">±7 days</span>
      </div>

      <div className="divide-y divide-slate-100">
        {upcoming.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">
            No ETAs in the ±7 day window
          </div>
        ) : (
          upcoming.map(ws => {
            const effectiveEta = ws.revisedEta ?? ws.eta
            const days = daysUntil(effectiveEta)
            const isOverdue = days < 0

            return (
              <div
                key={ws.id}
                onClick={() => router.push(`/worksets/${ws.id}`)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {/* ETA indicator */}
                <div className={cn(
                  'w-14 text-center flex-shrink-0 py-1 rounded-lg',
                  isOverdue ? 'bg-red-50' : days <= 1 ? 'bg-amber-50' : 'bg-slate-50',
                )}>
                  <div className={cn(
                    'text-sm font-bold',
                    isOverdue ? 'text-red-600' : days <= 1 ? 'text-amber-600' : 'text-slate-600',
                  )}>
                    {isOverdue ? `-${Math.abs(days)}d` : days === 0 ? 'Today' : `+${days}d`}
                  </div>
                  <div className={cn('text-[9px] font-medium', isOverdue ? 'text-red-400' : 'text-slate-400')}>
                    {isOverdue ? 'OVERDUE' : 'to go'}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400">{ws.worksetId}</span>
                    {ws.isBlocked && <Ban className="w-3 h-3 text-red-400" />}
                    {ws.isEscalated && <ArrowUpRight className="w-3 h-3 text-orange-400" />}
                  </div>
                  <p className="text-sm font-medium text-slate-800 truncate">{ws.name}</p>
                  <p className="text-[11px] text-slate-400">{ws.locale} · {ws.workflow} · {ws.region}</p>
                </div>

                {/* Status */}
                <div className="flex-shrink-0">
                  <Badge className={STATUS_COLORS[ws.status]}>{STATUS_LABELS[ws.status]}</Badge>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

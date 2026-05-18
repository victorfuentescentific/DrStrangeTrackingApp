'use client'

import { useRouter } from 'next/navigation'
import {
  AlertOctagon, Clock, ShieldAlert, Ban, CheckCircle2,
  Layers, TrendingUp, ArrowUpRight,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface StatCard {
  label: string
  value: number
  icon: React.ElementType
  color: string
  bg: string
  border: string
  filter?: string
  description: string
}

export function StatsCards() {
  const router = useRouter()
  const worksets = useStore(s => s.worksets)
  const notifications = useStore(s => s.notifications)

  const stats = {
    total:               worksets.length,
    overdue:             worksets.filter(w => w.status === 'overdue').length,
    atRisk:              worksets.filter(w => (w.status === 'at-risk' || w.riskLevel === 'high' || w.riskLevel === 'critical') && w.status !== 'completed').length,
    blocked:             worksets.filter(w => w.isBlocked && w.status !== 'completed').length,
    completed:           worksets.filter(w => w.status === 'completed').length,
    inProgress:          worksets.filter(w => w.status === 'in-progress').length,
    notStarted:          worksets.filter(w => w.status === 'not-started').length,
    escalated:           worksets.filter(w => w.isEscalated && w.status !== 'completed').length,
    unreadNotifications: notifications.filter(n => !n.isRead).length,
  }

  const cards: StatCard[] = [
    {
      label: 'Total Worksets', value: stats.total,
      icon: Layers, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200',
      description: 'All tracked worksets',
    },
    {
      label: 'Overdue', value: stats.overdue,
      icon: AlertOctagon, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200',
      filter: 'status=overdue', description: 'Past ETA, not completed',
    },
    {
      label: 'At Risk', value: stats.atRisk,
      icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200',
      filter: 'status=at-risk', description: 'High risk or ETA < 3 days',
    },
    {
      label: 'Blocked', value: stats.blocked,
      icon: Ban, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100',
      description: 'Awaiting unblock',
    },
    {
      label: 'Escalated', value: stats.escalated,
      icon: ArrowUpRight, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200',
      description: 'Needs leadership attention',
    },
    {
      label: 'In Progress', value: stats.inProgress,
      icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200',
      filter: 'status=in-progress', description: 'Actively being worked',
    },
    {
      label: 'Completed', value: stats.completed,
      icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200',
      filter: 'status=completed', description: 'Successfully delivered',
    },
    {
      label: 'Not Started', value: stats.notStarted,
      icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200',
      filter: 'status=not-started', description: 'Queued for start',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map(card => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            onClick={() => router.push('/worksets')}
            className={cn(
              'bg-white rounded-xl border p-4 hover:shadow-md transition-all cursor-pointer group',
              card.border,
            )}
          >
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', card.bg)}>
              <Icon className={cn('w-4 h-4', card.color)} />
            </div>
            <div className={cn('text-2xl font-bold', card.color)}>{card.value}</div>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">{card.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5 hidden group-hover:block">{card.description}</div>
          </div>
        )
      })}
    </div>
  )
}

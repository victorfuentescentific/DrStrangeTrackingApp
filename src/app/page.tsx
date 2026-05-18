'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { UpcomingETAs } from '@/components/dashboard/UpcomingETAs'
import { WorkloadChart } from '@/components/dashboard/WorkloadChart'
import { useStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { Ban, ArrowUpRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { STATUS_COLORS, STATUS_LABELS, daysUntil, cn } from '@/lib/utils'
import { WORKFLOW_COLORS } from '@/lib/eta-calculator'
import { WorkflowType } from '@/lib/types'

function QuickAlerts() {
  const router = useRouter()
  const worksets = useStore(s => s.worksets)

  const escalated = worksets.filter(w => w.isEscalated && w.status !== 'completed')
  const overdueBlocked = worksets.filter(w => w.isBlocked && (w.status === 'overdue' || w.status === 'at-risk'))

  if (escalated.length === 0 && overdueBlocked.length === 0) return null

  return (
    <div className="space-y-2">
      {escalated.map(ws => (
        <div
          key={ws.id}
          onClick={() => router.push(`/worksets/${ws.id}`)}
          className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 cursor-pointer hover:shadow-sm transition-all"
        >
          <ArrowUpRight className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-orange-800">
              Escalation: {ws.worksetId} — {ws.name}
            </p>
            <p className="text-xs text-orange-600 mt-0.5">{ws.escalationReason ?? 'Review required'}</p>
          </div>
          <Badge className="bg-orange-100 text-orange-700">Escalated</Badge>
        </div>
      ))}
      {overdueBlocked.map(ws => (
        <div
          key={ws.id}
          onClick={() => router.push(`/worksets/${ws.id}`)}
          className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 cursor-pointer hover:shadow-sm transition-all"
        >
          <Ban className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800">
              Blocked + {ws.status}: {ws.worksetId} — {ws.name}
            </p>
            <p className="text-xs text-red-600 mt-0.5">{ws.blockerDescription}</p>
          </div>
          <Badge className={STATUS_COLORS[ws.status]}>{STATUS_LABELS[ws.status]}</Badge>
        </div>
      ))}
    </div>
  )
}

function WorkflowBreakdown() {
  const worksets = useStore(s => s.worksets)
  const wfTypes: WorkflowType[] = ['DAX', 'DMO', 'Scribing']

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-slate-800">By Workflow</h3>
      </CardHeader>
      <CardBody className="space-y-3">
        {wfTypes.map(wf => {
          const wws  = worksets.filter(w => w.workflow === wf)
          if (wws.length === 0) return null
          const done = wws.filter(w => w.status === 'completed').length
          const pct  = Math.round((done / wws.length) * 100)
          const color = WORKFLOW_COLORS[wf]
          return (
            <div key={wf}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm text-slate-700 font-medium">{wf}</span>
                </div>
                <span className="text-xs text-slate-400">{done}/{wws.length} done · {pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          )
        })}
        {worksets.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-2">No worksets yet</p>
        )}
      </CardBody>
    </Card>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { currentUser } = useStore()

  return (
    <AppLayout
      title="Dashboard"
      subtitle={`Welcome back, ${currentUser.name} · ${new Date().toDateString()}`}
    >
      <div className="space-y-6">
        {/* Top action bar */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-slate-500">PM Operations Overview</h2>
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => router.push('/worksets/new')}
          >
            New Workset
          </Button>
        </div>

        {/* Quick alerts */}
        <QuickAlerts />

        {/* Stats */}
        <StatsCards />

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <UpcomingETAs />
          </div>
          <div className="space-y-6">
            <WorkloadChart />
            <WorkflowBreakdown />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

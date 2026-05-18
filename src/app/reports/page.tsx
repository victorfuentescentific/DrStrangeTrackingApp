'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { generateDailySummaryText, generateWeeklyReportText } from '@/lib/notification-engine'
import { daysUntil, formatDate, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, cn } from '@/lib/utils'
import { Copy, CheckCheck, BarChart3, Calendar, AlertOctagon, Ban, ArrowUpRight } from 'lucide-react'

function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-slate-800 mt-4 mb-1">{line.slice(3)}</h2>
    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-slate-700 mt-3 mb-1.5">{line.slice(4)}</h3>
    if (line.startsWith('- **')) {
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      return <li key={i} className="text-sm text-slate-600 ml-4 my-0.5" dangerouslySetInnerHTML={{ __html: bold.slice(2) }} />
    }
    if (line.startsWith('- ')) return <li key={i} className="text-sm text-slate-600 ml-4 my-0.5">{line.slice(2)}</li>
    if (line.trim() === '') return <div key={i} className="h-2" />
    const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    return <p key={i} className="text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: bold }} />
  })
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  )
}

export default function ReportsPage() {
  const worksets = useStore(s => s.worksets)
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily')

  const daily = generateDailySummaryText(worksets)
  const weekly = generateWeeklyReportText(worksets)
  const currentText = tab === 'daily' ? daily : weekly

  // Stats for visual breakdown
  const overdue = worksets.filter(w => w.status === 'overdue')
  const blocked = worksets.filter(w => w.isBlocked && w.status !== 'completed')
  const escalated = worksets.filter(w => w.isEscalated && w.status !== 'completed')
  const completed = worksets.filter(w => w.status === 'completed')
  const completionPct = Math.round((completed.length / worksets.length) * 100)

  return (
    <AppLayout title="Reports" subtitle="Daily summaries, weekly risk reports, and PM digests">
      <div className="space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Completion Rate', value: `${completionPct}%`, sub: `${completed.length}/${worksets.length} done`, color: 'text-green-600' },
            { label: 'Overdue Items', value: overdue.length, sub: 'Require immediate action', color: 'text-red-600' },
            { label: 'Blocked Items', value: blocked.length, sub: 'Awaiting unblock', color: 'text-red-500' },
            { label: 'Escalations', value: escalated.length, sub: 'Leadership review needed', color: 'text-orange-600' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">{kpi.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{kpi.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report text */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex gap-1">
                <button
                  onClick={() => setTab('daily')}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    tab === 'daily' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100',
                  )}
                >
                  Daily Summary
                </button>
                <button
                  onClick={() => setTab('weekly')}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    tab === 'weekly' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100',
                  )}
                >
                  Weekly Report
                </button>
              </div>
              <CopyButton text={currentText} />
            </div>
            <div className="px-6 py-5 max-h-[600px] overflow-y-auto">
              <div className="space-y-0.5">
                {renderText(currentText)}
              </div>
            </div>
          </div>

          {/* Side panels */}
          <div className="space-y-4">
            {/* Overdue */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-semibold text-slate-800">Overdue Worksets</h3>
                </div>
              </CardHeader>
              <CardBody className="space-y-2">
                {overdue.length === 0 ? (
                  <p className="text-xs text-slate-400">None — great work!</p>
                ) : overdue.map(ws => (
                  <div key={ws.id} className="text-xs">
                    <div className="font-mono text-slate-400">{ws.worksetId}</div>
                    <div className="font-medium text-slate-700 truncate">{ws.name}</div>
                    <div className="text-red-500">{Math.abs(daysUntil(ws.revisedEta ?? ws.eta))}d overdue · {ws.workflow} · {ws.region}</div>
                  </div>
                ))}
              </CardBody>
            </Card>

            {/* Escalated */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-semibold text-slate-800">Escalations</h3>
                </div>
              </CardHeader>
              <CardBody className="space-y-2">
                {escalated.length === 0 ? (
                  <p className="text-xs text-slate-400">No active escalations</p>
                ) : escalated.map(ws => (
                  <div key={ws.id} className="text-xs">
                    <div className="font-mono text-slate-400">{ws.worksetId}</div>
                    <div className="font-medium text-slate-700 truncate">{ws.name}</div>
                    <div className="text-orange-500 text-[10px] line-clamp-1">{ws.escalationReason}</div>
                  </div>
                ))}
              </CardBody>
            </Card>

            {/* Blocked */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-slate-800">Blocked</h3>
                </div>
              </CardHeader>
              <CardBody className="space-y-2">
                {blocked.length === 0 ? (
                  <p className="text-xs text-slate-400">No blocked worksets</p>
                ) : blocked.map(ws => (
                  <div key={ws.id} className="text-xs">
                    <div className="font-mono text-slate-400">{ws.worksetId}</div>
                    <div className="font-medium text-slate-700 truncate">{ws.name}</div>
                    <div className="text-red-400 text-[10px] line-clamp-1">{ws.blockerDescription}</div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

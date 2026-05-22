'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { WeeklyProjections } from '@/components/projections/WeeklyProjections'
import { ProductionCalculator } from '@/components/projections/ProductionCalculator'
import { ProjectionHistory } from '@/components/projections/ProjectionHistory'
import { ProjectionActuals } from '@/components/projections/ProjectionActuals'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'weekly',     label: 'Weekly projections' },
  { id: 'calculator', label: 'Production calculator' },
  { id: 'history',    label: 'History' },
  { id: 'actuals',    label: 'vs Actuals' },
] as const
type Tab = typeof TABS[number]['id']

const SUBTITLES: Record<Tab, string> = {
  weekly:     'Estimated production output by phase, locale, and headcount for the current week',
  calculator: 'Calculate 1P output from available hours after subtracting IAA, 2Pass, and PHI',
  history:    'Weekly projection snapshots captured every Monday — track output trends over time',
  actuals:    'Compare projected output against real production numbers entered by your team',
}

export default function ProjectionsPage() {
  const [tab, setTab] = useState<Tab>('weekly')
  const { currentUser } = useStore()
  const isAdmin  = currentUser.role === 'admin'
  const canEdit  = isAdmin || currentUser.role === 'lead'

  return (
    <AppLayout title="Projections" subtitle={SUBTITLES[tab]}>
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors',
              tab === t.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'weekly'     && <WeeklyProjections />}
      {tab === 'calculator' && <ProductionCalculator />}
      {tab === 'history'    && <ProjectionHistory isAdmin={isAdmin} />}
      {tab === 'actuals'    && <ProjectionActuals canEdit={canEdit} />}
    </AppLayout>
  )
}

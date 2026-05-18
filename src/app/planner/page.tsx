'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { KanbanBoard } from '@/components/planner/KanbanBoard'
import { WorksetFilters } from '@/components/worksets/WorksetFilters'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ROLE_PERMISSIONS } from '@/lib/types'

export default function PlannerPage() {
  const router = useRouter()
  const { currentUser, getFilteredWorksets } = useStore()
  const perms = ROLE_PERMISSIONS[currentUser.role]
  const total = getFilteredWorksets().length

  return (
    <AppLayout
      title="Planner"
      subtitle={`Kanban board · ${total} workset${total !== 1 ? 's' : ''} · Click any card to view details`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Drag-and-drop ETA updates available in Phase 2. For now, click cards to edit.
          </p>
          {perms.canCreate && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => router.push('/worksets/new')}
            >
              New Workset
            </Button>
          )}
        </div>

        <WorksetFilters />
        <KanbanBoard />
      </div>
    </AppLayout>
  )
}

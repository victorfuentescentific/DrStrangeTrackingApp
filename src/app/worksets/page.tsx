'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { WorksetFilters } from '@/components/worksets/WorksetFilters'
import { WorksetTable } from '@/components/worksets/WorksetTable'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { Plus, Download } from 'lucide-react'
import { ROLE_PERMISSIONS } from '@/lib/types'

export default function WorksetsPage() {
  const router = useRouter()
  const { getFilteredWorksets, currentUser } = useStore()
  const perms = ROLE_PERMISSIONS[currentUser.role]
  const worksets = getFilteredWorksets()

  const handleExport = () => {
    const json = JSON.stringify(worksets, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `worksets-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppLayout
      title="Worksets"
      subtitle={`${worksets.length} workset${worksets.length !== 1 ? 's' : ''} · Click any row to view details`}
    >
      <div className="space-y-4">
        {/* Actions bar */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-500">All Worksets</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>
              Export JSON
            </Button>
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
        </div>

        {/* Filters */}
        <WorksetFilters />

        {/* Table */}
        <WorksetTable worksets={worksets} />
      </div>
    </AppLayout>
  )
}

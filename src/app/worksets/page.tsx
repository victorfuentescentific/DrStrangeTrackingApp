'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { WorksetFilters } from '@/components/worksets/WorksetFilters'
import { WorksetTable } from '@/components/worksets/WorksetTable'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { Plus, Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { ROLE_PERMISSIONS } from '@/lib/types'

export default function WorksetsPage() {
  const router = useRouter()
  const { getFilteredWorksets, currentUser, reloadWorksets } = useStore()
  const perms = ROLE_PERMISSIONS[currentUser.role]
  const worksets = getFilteredWorksets()

  const [recalcState, setRecalcState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [recalcMsg,  setRecalcMsg]   = useState<string | null>(null)

  // Reload from DB every time the user visits this page so cross-user
  // changes (e.g. a workset created by another admin) are always visible.
  useEffect(() => {
    void reloadWorksets()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  async function handleRecalculate() {
    setRecalcState('running')
    setRecalcMsg(null)
    try {
      const res = await fetch('/api/admin/worksets/recalculate', { method: 'POST' })
      const body = await res.json()
      if (!res.ok || !body.ok) {
        setRecalcState('error')
        setRecalcMsg(body.message ?? body.error ?? 'Recalculation failed.')
      } else {
        setRecalcState('done')
        setRecalcMsg(body.message)
        // Force-reload store so the updated phases are reflected immediately
        await reloadWorksets()
      }
    } catch (e) {
      setRecalcState('error')
      setRecalcMsg(e instanceof Error ? e.message : 'Network error')
    }
    setTimeout(() => { setRecalcState('idle'); setRecalcMsg(null) }, 6000)
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
          <div className="flex gap-2 items-center">
            {/* Recalculate timelines — admin only */}
            {currentUser.role === 'admin' && (
              <div className="flex items-center gap-2">
                {recalcMsg && (
                  <span className={`text-xs flex items-center gap-1 ${recalcState === 'error' ? 'text-red-600' : 'text-green-700'}`}>
                    {recalcState === 'error'
                      ? <AlertCircle className="w-3.5 h-3.5" />
                      : <CheckCircle className="w-3.5 h-3.5" />}
                    {recalcMsg}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  icon={<RefreshCw className={`w-3.5 h-3.5 ${recalcState === 'running' ? 'animate-spin' : ''}`} />}
                  onClick={handleRecalculate}
                  disabled={recalcState === 'running'}
                >
                  {recalcState === 'running' ? 'Recalculating…' : 'Recalculate Timelines'}
                </Button>
              </div>
            )}

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

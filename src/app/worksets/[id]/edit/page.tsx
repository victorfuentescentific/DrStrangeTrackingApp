'use client'

import { useParams, useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { WorksetForm } from '@/components/worksets/WorksetForm'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/lib/store'
import { ROLE_PERMISSIONS } from '@/lib/types'
import { calculateETA } from '@/lib/eta-calculator'
import { ArrowLeft } from 'lucide-react'

export default function WorksetEditPage() {
  const params = useParams()
  const router = useRouter()
  const { worksets, updateWorkset, currentUser } = useStore()
  const perms = ROLE_PERMISSIONS[currentUser.role]

  const ws = worksets.find(w => w.id === params.id)

  if (!ws) {
    return (
      <AppLayout title="Workset Not Found">
        <div className="text-center py-16">
          <p className="text-slate-500">This workset does not exist or has been deleted.</p>
          <Button variant="ghost" onClick={() => router.push('/worksets')} className="mt-4">
            ← Back to Worksets
          </Button>
        </div>
      </AppLayout>
    )
  }

  if (!perms.canEdit) {
    router.replace(`/worksets/${ws.id}`)
    return null
  }

  return (
    <AppLayout
      title={`Edit ${ws.worksetId}`}
      subtitle={ws.name}
    >
      <div className="max-w-3xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => router.push(`/worksets/${ws.id}`)}
        >
          Back to Workset
        </Button>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <WorksetForm
            initial={ws}
            isEdit
            onCancel={() => router.push(`/worksets/${ws.id}`)}
            onSubmit={(form) => {
              const n = parseInt(form.teamSize) || 11
              const newPhases = form.locale && form.startDate && n >= 5
                ? calculateETA(form.workflow, form.locale, n, form.startDate)
                : undefined
              updateWorkset(ws.id, {
                name:              form.name,
                workflow:          form.workflow,
                locale:            form.locale,
                team:              form.team,
                region:            form.region,
                teamSize:          n,
                startDate:         form.startDate,
                eta:               form.eta,
                revisedEta:        form.revisedEta || undefined,
                phases:            newPhases,
                status:            form.status,
                priority:          form.priority,
                riskLevel:         form.riskLevel,
                expirationDate:    form.expirationDate || undefined,
                isBlocked:         form.isBlocked,
                blockerDescription:form.blockerDescription || undefined,
                isEscalated:       form.isEscalated,
                escalationReason:  form.escalationReason || undefined,
                notes:             form.notes,
                completedAt:       form.status === 'completed' && !ws.completedAt
                  ? new Date().toISOString().split('T')[0]
                  : ws.completedAt,
              }, 'Manual edit via full-page form')
              router.push(`/worksets/${ws.id}`)
            }}
          />
        </div>
      </div>
    </AppLayout>
  )
}

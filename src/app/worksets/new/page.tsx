'use client'

import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { WorksetForm } from '@/components/worksets/WorksetForm'
import { useStore } from '@/lib/store'
import { ROLE_PERMISSIONS } from '@/lib/types'
import { calculateETA } from '@/lib/eta-calculator'

export default function NewWorksetPage() {
  const router = useRouter()
  const { addWorkset, linkSuccessor, currentUser } = useStore()
  const perms = ROLE_PERMISSIONS[currentUser.role]

  if (!perms.canCreate) {
    return (
      <AppLayout title="New Workset">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <p className="text-red-700 font-medium">You do not have permission to create worksets.</p>
          <p className="text-red-500 text-sm mt-1">Role required: admin, pm, or lead</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="New Workset" subtitle="Fill in the details to create a new tracked workset">
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <WorksetForm
            onCancel={() => router.push('/worksets')}
            onSubmit={(form) => {
              const n = parseInt(form.teamSize) || 11
              // For sequential worksets, linkSuccessor calculates phases; skip standalone calc
              const phases = !form.predecessorId && form.locale && form.startDate && n >= 5
                ? calculateETA(form.workflow, form.locale, n, form.startDate)
                : undefined
              const newWorkset = addWorkset({
                name: form.name,
                workflow: form.workflow,
                locale: form.locale,
                team: form.team,
                region: form.region,
                teamSize: n,
                startDate: form.startDate,
                eta: form.eta,
                revisedEta: form.revisedEta || undefined,
                phases,
                status: form.status,
                priority: form.priority,
                riskLevel: form.riskLevel,
                isBlocked: form.isBlocked,
                blockerDescription: form.blockerDescription || undefined,
                isEscalated: form.isEscalated,
                escalationReason: form.escalationReason || undefined,
                notes: form.notes,
              })
              if (form.predecessorId) {
                linkSuccessor(form.predecessorId, newWorkset.id)
              }
              router.push('/worksets')
            }}
          />
        </div>
      </div>
    </AppLayout>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { WorksetForm } from '@/components/worksets/WorksetForm'
import { useStore } from '@/lib/store'
import { ROLE_PERMISSIONS } from '@/lib/types'
import { calculateETA } from '@/lib/eta-calculator'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function NewWorksetPage() {
  const router = useRouter()
  const { addWorkset, linkSuccessor, currentUser } = useStore()
  const perms = ROLE_PERMISSIONS[currentUser.role]

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

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
        <div className="bg-white rounded-xl border border-slate-200 p-6 relative">
          {/* Saving overlay */}
          {submitting && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl z-10">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving workset…
              </div>
            </div>
          )}

          {submitError && (
            <div className="mb-4 flex gap-2 items-start bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <WorksetForm
            onCancel={() => router.push('/worksets')}
            onSubmit={async (form) => {
              setSubmitting(true)
              setSubmitError(null)
              const n = parseInt(form.teamSize) || 11
              // For sequential worksets, linkSuccessor calculates phases; skip standalone calc
              const phases = !form.predecessorId && form.locale && form.startDate && n >= 1
                ? calculateETA(form.workflow, form.locale, n, form.startDate)
                : undefined
              try {
                const newWorkset = await addWorkset({
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
                  expirationDate: form.expirationDate || undefined,
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
              } catch (err) {
                setSubmitError(err instanceof Error ? err.message : 'Failed to create workset. Please try again.')
                setSubmitting(false)
              }
            }}
          />
        </div>
      </div>
    </AppLayout>
  )
}

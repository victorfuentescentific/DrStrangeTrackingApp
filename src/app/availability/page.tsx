'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { AvailabilityGrid } from '@/components/availability/AvailabilityGrid'

interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  locale: string | null
  employeeType: string | null
  workflow: string | null
}

export default function AvailabilityPage() {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then(data => {
        if (data) setUser(data.user)
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <AppLayout title="My Availability">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Availability</h1>
          <p className="text-sm text-gray-500 mt-1">
            Click any weekday to submit or update your availability.
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Amber dot = missing submission
            </span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <AvailabilityGrid
            userId={user.id}
            employeeType={user.employeeType}
            locale={user.locale}
            workflow={user.workflow}
          />
        </div>
      </div>
    </AppLayout>
  )
}

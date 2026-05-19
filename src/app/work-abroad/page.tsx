'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Plane } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { type WorkAbroadRequest } from '@/lib/work-abroad'

export default function WorkAbroadPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<WorkAbroadRequest[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.status === 401) { router.push('/login'); return null }
      return r.json()
    }).then(data => {
      if (!data) return
      fetch('/api/work-abroad')
        .then(r => r.json())
        .then(d => setRequests(Array.isArray(d) ? d : []))
        .finally(() => setLoading(false))
    })
  }, [router])

  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Cancel this work abroad request?')) return
    await fetch(`/api/work-abroad?id=${id}`, { method: 'DELETE' })
    setRequests(r => r.filter(x => x.id !== id))
  }

  return (
    <AppLayout title="Work Abroad" subtitle="Manage your work abroad requests">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Work Abroad</h1>
          <Link href="/work-abroad/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> New request
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Plane className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No work abroad requests yet</p>
            <Link href="/work-abroad/new" className="mt-3 inline-block text-blue-600 text-sm font-medium hover:underline">
              Submit your first request
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                      <Plane className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {r.originCountry} → {r.destinationCountry}
                      </p>
                      <p className="text-sm text-gray-500">
                        {fmtDate(r.dateFrom)} – {fmtDate(r.dateTo)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {r.notes && (
                  <p className="mt-3 text-sm text-gray-500 pl-13">{r.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

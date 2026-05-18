'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/lib/auth'

export function useSession(): { user: SessionUser | null; loading: boolean } {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((data) => {
        setUser(data?.user ?? null)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { user, loading }
}

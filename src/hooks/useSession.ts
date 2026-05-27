'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/lib/auth'

// Auto-logout after 30 minutes of inactivity
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000

export function useSession(): { user: SessionUser | null; loading: boolean } {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch current session on mount
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

  // Inactivity auto-logout — resets on any user interaction
  useEffect(() => {
    if (!user) return

    let timer: ReturnType<typeof setTimeout>

    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
        window.location.href = '/login'
      }, INACTIVITY_TIMEOUT_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer() // Start the timer immediately

    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [user])

  return { user, loading }
}

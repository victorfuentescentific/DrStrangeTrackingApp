'use client'

import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { NotificationPanel } from '@/components/ui/NotificationPanel'
import { useStore } from '@/lib/store'

interface AppLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

// Module-level timestamp — persists across AppLayout mounts (page navigations)
// so we only hit the API once per STALE_MS window, not on every navigation.
let _lastReloadMs = 0
const STALE_MS = 30_000 // 30 seconds

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const { initialize, reloadWorksets, isNotificationPanelOpen } = useStore()

  useEffect(() => {
    // One-time setup: session user + initial workset load (no-op after first run)
    void initialize()
    // Stale-while-revalidate: refresh worksets on every navigation,
    // but throttled to at most once per 30 s to avoid hammering the API.
    if (Date.now() - _lastReloadMs > STALE_MS) {
      _lastReloadMs = Date.now()
      void reloadWorksets()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden ml-60">
        <Header title={title} subtitle={subtitle} />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {isNotificationPanelOpen && <NotificationPanel />}
    </div>
  )
}

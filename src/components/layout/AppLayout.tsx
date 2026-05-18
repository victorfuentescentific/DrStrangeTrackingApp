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

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const { initialize, isNotificationPanelOpen } = useStore()

  useEffect(() => {
    initialize()
  }, [initialize])

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

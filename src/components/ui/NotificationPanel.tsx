'use client'

import { X, CheckCheck, Bell } from 'lucide-react'
import { useStore } from '@/lib/store'
import { formatDate, cn } from '@/lib/utils'
import { NOTIFICATION_ICONS } from '@/lib/utils'

export function NotificationPanel() {
  const { notifications, markNotificationRead, markAllNotificationsRead, toggleNotificationPanel } = useStore()

  const sorted = [...notifications].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const unread = notifications.filter(n => !n.isRead).length

  const PRIORITY_BG: Record<string, string> = {
    high:   'border-l-red-500',
    medium: 'border-l-amber-500',
    low:    'border-l-slate-300',
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={toggleNotificationPanel} />

      {/* Panel */}
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-600" />
            <h2 className="font-semibold text-slate-800">Notifications</h2>
            {unread > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 px-2 py-1 rounded hover:bg-brand-50 transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
            <button
              onClick={toggleNotificationPanel}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Bell className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sorted.map(n => (
                <div
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={cn(
                    'flex gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-l-4',
                    PRIORITY_BG[n.priority],
                    n.isRead ? 'opacity-60' : '',
                  )}
                >
                  <div className="text-lg flex-shrink-0 mt-0.5">
                    {NOTIFICATION_ICONS[n.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm font-medium text-slate-800 truncate', n.isRead ? 'font-normal' : '')}>
                        {n.title}
                      </p>
                      {!n.isRead && <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    {n.worksetName && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        {n.worksetName}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
          <p className="text-[11px] text-slate-400 text-center">
            MVP: Notifications are simulated. Email & Teams in Phase 2.
          </p>
        </div>
      </aside>
    </>
  )
}

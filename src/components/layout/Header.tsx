'use client'

import { Bell, RefreshCw, ChevronDown } from 'lucide-react'
import { useStore, MOCK_USERS } from '@/lib/store'
import { ROLE_COLORS, cn } from '@/lib/utils'
import { useState } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { currentUser, setCurrentUser, toggleNotificationPanel, refreshNotifications } = useStore()
  const unreadNotifications = useStore(s => s.notifications.filter(n => !n.isRead).length)
  const [showUserMenu, setShowUserMenu] = useState(false)

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Refresh */}
        <button
          onClick={refreshNotifications}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          title="Refresh notifications"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Notification Bell */}
        <button
          onClick={toggleNotificationPanel}
          className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>

        {/* User switcher (MVP: role simulation) */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold">
              {currentUser.initials}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-medium text-slate-800">{currentUser.name}</div>
              <div className={cn('text-[10px] px-1 rounded font-medium capitalize', ROLE_COLORS[currentUser.role])}>
                {currentUser.role}
              </div>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30">
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Switch Role (Demo)</p>
                {MOCK_USERS.map(user => (
                  <button
                    key={user.id}
                    onClick={() => { setCurrentUser(user.id); setShowUserMenu(false) }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors',
                      currentUser.id === user.id ? 'bg-brand-50' : '',
                    )}
                  >
                    <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-white text-[10px] font-semibold">
                      {user.initials}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-medium text-slate-800">{user.name}</div>
                      <div className={cn('text-[10px] capitalize', ROLE_COLORS[user.role])}>{user.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

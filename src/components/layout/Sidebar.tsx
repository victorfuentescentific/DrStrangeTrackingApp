'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ListChecks, Kanban, BarChart3, Bot,
  Settings, ChevronRight, CalendarDays, Calculator, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/worksets',     label: 'Worksets',     icon: ListChecks },
  { href: '/calendar',     label: 'Calendar',     icon: CalendarDays },
  { href: '/projections',  label: 'Projections',  icon: Calculator },
  { href: '/admin/hours',  label: 'Team Hours',   icon: Clock },
  { href: '/planner',      label: 'Planner',      icon: Kanban },
  { href: '/reports',      label: 'Reports',      icon: BarChart3 },
  { href: '/claude',       label: 'Claude AI',    icon: Bot },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-60 bg-slate-900 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <Kanban className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">WorksetPM</div>
            <div className="text-[10px] text-slate-400">ETA Tracker</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="px-2 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Main Menu
          </p>
        </div>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group',
                active
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white',
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{label}</span>
              </div>
              {active && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800">
          <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center">
            <Settings className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs text-slate-400">MVP v0.1</span>
        </div>
      </div>
    </aside>
  )
}

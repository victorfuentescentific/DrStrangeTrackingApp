'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ListChecks, Kanban, BarChart3,
  Settings, ChevronRight, CalendarDays, Calculator, Clock,
  CalendarCheck, Users, Plane, ShieldCheck, UserCog, NotebookPen, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/useSession'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles?: ('admin' | 'lead' | 'fte' | 'freelancer')[]
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Planning',
    items: [
      { href: '/',             label: 'Dashboard',       icon: LayoutDashboard },
      { href: '/worksets',     label: 'Worksets',        icon: ListChecks },
      { href: '/calendar',     label: 'Calendar',        icon: CalendarDays },
      { href: '/projections',  label: 'Projections',     icon: Calculator },
      { href: '/planner',      label: 'Planner',         icon: Kanban },
    ],
  },
  {
    label: 'Availability',
    items: [
      { href: '/availability', label: 'My Availability', icon: CalendarCheck },
      { href: '/work-abroad',  label: 'Work Abroad',     icon: Plane },
      { href: '/overview',     label: 'Team Time Off',   icon: Users },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { href: '/admin/hours',  label: 'Team Hours',      icon: Clock },
      { href: '/reports',      label: 'Reports',         icon: BarChart3 },
      // AI Assistant — hidden until Vercel deployment & Gemini key issues are resolved.
      // To re-enable: uncomment the line below. All code at /ai and /api/ai/* is intact.
      // { href: '/ai', label: 'AI Assistant', icon: Sparkles, roles: ['admin', 'lead'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/admin/headcount',    label: 'HC Overview',        icon: UserCog,    roles: ['admin', 'lead'] },
      { href: '/admin/submissions',  label: 'Hours Submissions',  icon: ShieldCheck, roles: ['admin'] },
      { href: '/notes',              label: 'Notes & Links',      icon: NotebookPen, roles: ['admin'] },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user } = useSession()
  const role = user?.role

  const visibleSections = NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => !item.roles || (role && item.roles.includes(role))),
  })).filter(section => section.items.length > 0)

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-60 flex flex-col overflow-hidden bg-gradient-to-b from-deep-1000 via-deep-900 to-deep-1000">
      {/* Subtle amber light behind the logo area */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />

      {/* Logo */}
      <div className="relative h-16 flex items-center px-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <BrandSeal />
          <div>
            <div className="text-sm font-bold text-brand-100 tracking-wide leading-tight">Dr. Strange Portal</div>
            <div className="text-[10px] text-accent-100/60 tracking-widest uppercase">EU LLM Data</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {visibleSections.map(section => (
          <div key={section.label}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-accent-100/40">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'group relative flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all',
                      active
                        ? 'bg-white/[0.06] text-brand-200 shadow-[inset_2px_0_0_0_rgba(245,158,11,0.8)]'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-brand-100',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={cn(
                        'w-4 h-4 flex-shrink-0 transition-colors',
                        active ? 'text-brand-300' : 'text-slate-500 group-hover:text-brand-200',
                      )} />
                      <span className="font-medium">{label}</span>
                    </div>
                    {active && <ChevronRight className="w-3 h-3 text-brand-300/60" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="relative p-3 border-t border-white/5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-accent-700 flex items-center justify-center shadow-brand-glow">
            <Settings className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] text-accent-100/50 tracking-wide">MVP v0.1</span>
        </div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BrandSeal — a small rotating sacred-circle glyph used as the sidebar logo.
// Custom hand-drawn SVG, not copyrighted artwork.
// ─────────────────────────────────────────────────────────────────────────────
function BrandSeal() {
  return (
    <div className="relative w-8 h-8 flex-shrink-0">
      {/* Subtle amber halo */}
      <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-md" />
      {/* Outer rotating ring */}
      <svg
        viewBox="0 0 32 32"
        className="absolute inset-0 spin-very-slow"
        fill="none"
        stroke="currentColor"
      >
        <circle cx="16" cy="16" r="14" strokeDasharray="1.5 3" className="text-brand-400/70" strokeWidth="0.8" />
        <circle cx="16" cy="16" r="10" className="text-brand-300/40" strokeWidth="0.5" />
      </svg>
      {/* Inner static glyph */}
      <svg
        viewBox="0 0 32 32"
        className="absolute inset-0"
        fill="none"
        stroke="currentColor"
      >
        <polygon
          points="16,7 22,12 22,20 16,25 10,20 10,12"
          className="text-brand-300"
          strokeWidth="1"
        />
        <circle cx="16" cy="16" r="2.5" fill="currentColor" className="text-brand-300" />
      </svg>
    </div>
  )
}

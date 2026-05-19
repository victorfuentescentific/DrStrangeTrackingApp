'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { KeyRound, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  employee_type: string | null
  locale: string | null
  workflow: string | null
  is_active: boolean
}

const ROLE_COLORS: Record<string, string> = {
  admin:      'bg-purple-100 text-purple-700',
  fte:        'bg-blue-100 text-blue-700',
  freelancer: 'bg-gray-100 text-gray-600',
}

const EMP_COLORS: Record<string, string> = {
  FTE:        'bg-blue-50 text-blue-600',
  FREELANCER: 'bg-gray-50 text-gray-500',
  PM:         'bg-purple-50 text-purple-600',
}

// ── Password cell ─────────────────────────────────────────────────────────────

function PasswordCell({ userId, hasPlaceholder }: { userId: string; hasPlaceholder: boolean }) {
  const [open,    setOpen]    = useState(false)
  const [pw,      setPw]      = useState('')
  const [saving,  setSaving]  = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function save() {
    if (!pw) return
    setSaving(true); setError(null)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, password: pw }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed')
      return
    }
    setDone(true); setOpen(false); setPw('')
    setTimeout(() => setDone(false), 3000)
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {done ? (
          <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
            <Check className="w-3.5 h-3.5" /> Set
          </span>
        ) : hasPlaceholder ? (
          <span className="text-xs text-amber-600 font-medium">No password</span>
        ) : (
          <span className="text-xs text-gray-400">••••••••</span>
        )}
        <button
          onClick={() => setOpen(true)}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
          title="Set password"
        >
          <KeyRound className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        type="password"
        value={pw}
        onChange={e => setPw(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false) }}
        placeholder="New password"
        className="w-32 text-xs rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        onClick={save}
        disabled={!pw || saving}
        className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => { setOpen(false); setPw('') }}
        className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LOCALES = ['nl_NL','de_DE','fr_FR','en_GB','da_DK','nb_NO','fi_FI','sv_SE']
const ROLES   = ['admin','fte','freelancer']

export default function AdminUsersPage() {
  const router = useRouter()
  const [users,   setUsers]   = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filterRole,   setFilterRole]   = useState('')
  const [filterLocale, setFilterLocale] = useState('')
  const [expandGroup, setExpandGroup]   = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.status === 401) { router.push('/login'); return null }
      return r.json()
    }).then(data => {
      if (data?.user?.role !== 'admin') { router.push('/'); return }
      loadUsers()
    })
  }, [router])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  const filtered = users.filter(u => {
    if (filterRole   && u.role   !== filterRole)   return false
    if (filterLocale && u.locale !== filterLocale) return false
    if (search) {
      const q = search.toLowerCase()
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Group by role → locale
  type Group = { label: string; users: AdminUser[] }
  const groups: Group[] = []

  const roleOrder = ['admin', 'fte', 'freelancer']
  for (const role of roleOrder) {
    const roleUsers = filtered.filter(u => u.role === role)
    if (roleUsers.length === 0) continue

    // Sub-group by locale within role
    const localeMap: Record<string, AdminUser[]> = {}
    for (const u of roleUsers) {
      const key = u.locale ?? '__management__'
      if (!localeMap[key]) localeMap[key] = []
      localeMap[key].push(u)
    }
    const localeKeys = Object.keys(localeMap).filter(k => k !== '__management__').sort()
    if (localeMap['__management__']) localeKeys.push('__management__')

    for (const lk of localeKeys) {
      const label = `${role.toUpperCase()} · ${lk === '__management__' ? 'Management' : lk}`
      groups.push({ label, users: localeMap[lk] })
    }
  }

  const noPassword = users.filter(u => u.id.startsWith('fte-') || u.id.startsWith('fl-')).length
  const noPasswordSet = users.filter(u =>
    (u.id.startsWith('fte-') || u.id.startsWith('fl-'))
  ).length

  return (
    <AppLayout title="Users" subtitle="Admin — manage users and passwords">
      <div className="px-4 py-8 space-y-5">

        {/* Banner */}
        {noPasswordSet > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{noPasswordSet} imported users</span> still have no password set — click the key icon on each row to set one.
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterLocale} onChange={e => setFilterLocale(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All locales</option>
            {LOCALES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <span className="text-sm text-gray-400 ml-auto">{filtered.length} users</span>
        </div>

        {/* Groups */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : (
          <div className="space-y-3">
            {groups.map(group => {
              const isOpen = expandGroup[group.label] !== false // default open
              return (
                <div key={group.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Group header */}
                  <button
                    onClick={() => setExpandGroup(s => ({ ...s, [group.label]: !isOpen }))}
                    className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      {group.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{group.users.length} users</span>
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </button>

                  {/* User rows */}
                  {isOpen && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-50">
                          <th className="text-left px-5 py-2 text-xs font-medium text-gray-400 w-48">Name</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">Email</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-24">Role</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-20">Type</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-48">Password</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.users.map(u => (
                          <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                            <td className="px-5 py-2.5 font-medium text-gray-900">{u.name}</td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs">{u.email}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              {u.employee_type && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EMP_COLORS[u.employee_type] ?? 'bg-gray-100 text-gray-500'}`}>
                                  {u.employee_type}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <PasswordCell
                                userId={u.id}
                                hasPlaceholder={u.email.endsWith('@import.placeholder')}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

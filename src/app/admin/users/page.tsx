'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { KeyRound, Check, X, ChevronDown, ChevronUp, Pencil } from 'lucide-react'

interface AdminUser {
  id:            string
  name:          string
  email:         string
  role:          string
  employee_type: string | null
  locale:        string | null
  workflow:      string | null
  is_active:     boolean
}

const ROLES          = ['admin', 'lead', 'fte', 'freelancer'] as const
const EMPLOYEE_TYPES = ['FTE', 'FREELANCER', 'PM'] as const

const ROLE_COLORS: Record<string, string> = {
  admin:      'bg-purple-100 text-purple-700',
  lead:       'bg-indigo-100 text-indigo-700',
  fte:        'bg-blue-100 text-blue-700',
  freelancer: 'bg-gray-100 text-gray-600',
}
const EMP_COLORS: Record<string, string> = {
  FTE:        'bg-blue-50 text-blue-600',
  FREELANCER: 'bg-gray-50 text-gray-500',
  PM:         'bg-purple-50 text-purple-600',
}

// ── Edit user modal ───────────────────────────────────────────────────────────

interface EditModalProps {
  user:     AdminUser
  locales:  string[]
  onSaved:  (updated: AdminUser) => void
  onClose:  () => void
}

function EditUserModal({ user, locales, onSaved, onClose }: EditModalProps) {
  const [name,         setName]         = useState(user.name)
  const [email,        setEmail]        = useState(user.email)
  const [role,         setRole]         = useState(user.role)
  const [empType,      setEmpType]      = useState(user.employee_type ?? '')
  const [locale,       setLocale]       = useState(user.locale ?? '')
  const [workflow,     setWorkflow]     = useState(user.workflow ?? '')
  const [isActive,     setIsActive]     = useState(user.is_active)
  const [password,     setPassword]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)

    const body: Record<string, unknown> = { id: user.id }
    if (name     !== user.name)            body.name         = name
    if (email    !== user.email)           body.email        = email
    if (role     !== user.role)            body.role         = role
    const et = empType || null
    if (et       !== user.employee_type)   body.employeeType = et
    const lc = locale || null
    if (lc       !== user.locale)          body.locale       = lc
    const wf = workflow || null
    if (wf       !== user.workflow)        body.workflow     = wf
    if (isActive !== user.is_active)       body.isActive     = isActive
    if (password)                          body.password     = password

    if (Object.keys(body).length === 1) { onClose(); return } // only id — nothing changed

    const res = await fetch('/api/admin/users', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }

    onSaved({
      ...user,
      name,
      email,
      role,
      employee_type: empType || null,
      locale:        locale  || null,
      workflow:      workflow || null,
      is_active:     isActive,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Edit user</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={save} className="space-y-4">
          {/* Name + email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Role + employee type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee type</label>
              <select
                value={empType}
                onChange={e => setEmpType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— none —</option>
                {EMPLOYEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Locale + workflow */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Locale</label>
              <select
                value={locale}
                onChange={e => setLocale(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Management —</option>
                {locales.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Workflow</label>
              <input
                value={workflow}
                onChange={e => setWorkflow(e.target.value)}
                placeholder="e.g. DMO, DAX…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              New password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-800">Active account</p>
              <p className="text-xs text-gray-400">Inactive users cannot log in</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const router = useRouter()
  const [users,        setUsers]        = useState<AdminUser[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterRole,   setFilterRole]   = useState('')
  const [filterLocale, setFilterLocale] = useState('')
  const [expandGroup,  setExpandGroup]  = useState<Record<string, boolean>>({})
  const [editing,      setEditing]      = useState<AdminUser | null>(null)

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

  // Derive locale list from actual users (no hardcoding)
  const locales = [...new Set(users.map(u => u.locale).filter(Boolean) as string[])].sort()

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
  const roleOrder = ['admin', 'lead', 'fte', 'freelancer']
  for (const role of roleOrder) {
    const roleUsers = filtered.filter(u => u.role === role)
    if (!roleUsers.length) continue
    const localeMap: Record<string, AdminUser[]> = {}
    for (const u of roleUsers) {
      const key = u.locale ?? '__management__'
      if (!localeMap[key]) localeMap[key] = []
      localeMap[key].push(u)
    }
    const localeKeys = Object.keys(localeMap).filter(k => k !== '__management__').sort()
    if (localeMap['__management__']) localeKeys.push('__management__')
    for (const lk of localeKeys) {
      groups.push({
        label: `${role.toUpperCase()} · ${lk === '__management__' ? 'Management' : lk}`,
        users: localeMap[lk],
      })
    }
  }

  const noPasswordSet = users.filter(u => u.email.endsWith('@import.placeholder')).length

  function handleSaved(updated: AdminUser) {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
    setEditing(null)
  }

  return (
    <AppLayout title="Users" subtitle="Admin — manage users">
      <div className="px-4 py-8 space-y-5">

        {/* Banner */}
        {noPasswordSet > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{noPasswordSet} imported users</span> still have no password — click the edit icon to set one.
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
            {locales.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <span className="text-sm text-gray-400 ml-auto">{filtered.length} users</span>
        </div>

        {/* Groups */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : (
          <div className="space-y-3">
            {groups.map(group => {
              const isOpen = expandGroup[group.label] !== false
              return (
                <div key={group.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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

                  {isOpen && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-50">
                          <th className="text-left px-5 py-2 text-xs font-medium text-gray-400 w-44">Name</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">Email</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-24">Role</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-24">Type</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-20">Locale</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-20">Status</th>
                          <th className="px-3 py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {group.users.map(u => (
                          <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                            <td className="px-5 py-2.5 font-medium text-gray-900">{u.name}</td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs">
                              {u.email.endsWith('@import.placeholder') ? (
                                <span className="text-amber-500 italic">no email set</span>
                              ) : u.email}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              {u.employee_type && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EMP_COLORS[u.employee_type] ?? 'bg-gray-100 text-gray-500'}`}>
                                  {u.employee_type === 'FREELANCER' ? 'FL' : u.employee_type}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-500">{u.locale ?? '—'}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                onClick={() => setEditing(u)}
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit user"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
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

      {editing && (
        <EditUserModal
          user={editing}
          locales={locales}
          onSaved={handleSaved}
          onClose={() => setEditing(null)}
        />
      )}
    </AppLayout>
  )
}

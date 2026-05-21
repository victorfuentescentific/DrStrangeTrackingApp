'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { KeyRound, ChevronDown, ChevronUp, Pencil, X } from 'lucide-react'

interface AdminUser {
  id:                  string
  name:                string
  email:               string
  role:                string
  employee_type:       string | null
  locale:              string | null
  workflow:            string | null
  is_active:           boolean
  emp_id:              string | null
  v_microsoft_email:   string | null
  ms_id:               string | null
  one_forma_id:        string | null
  personal_email:      string | null
  phone:               string | null
  shipping_address:    string | null
  start_date:          string | null
  batch:               string | null
  centific_type:       string | null
  role_designation:    string | null
  billable:            boolean | null
  overall_status:      string | null
  ms_account_status:   string | null
  phone_status:        string | null
  laptop_status:       string | null
  bgc_request_date:    string | null
  bgc_status:          string | null
  identity_check_date: string | null
  remarks:             string | null
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

// ── Shared input / label components ──────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ── Edit user modal ───────────────────────────────────────────────────────────

type Tab = 'identity' | 'employment' | 'onboarding' | 'contact'

interface EditModalProps {
  user:      AdminUser
  locales:   string[]
  onSaved:   (updated: AdminUser) => void
  onDeleted: (id: string) => void
  onClose:   () => void
}

function EditUserModal({ user, locales, onSaved, onDeleted, onClose }: EditModalProps) {
  const [tab, setTab] = useState<Tab>('identity')

  // Tab 1: Identity
  const [name,             setName]           = useState(user.name)
  const [email,            setEmail]          = useState(user.email)
  const [vMicrosoftEmail,  setVMicrosoftEmail] = useState(user.v_microsoft_email ?? '')
  const [personalEmail,    setPersonalEmail]  = useState(user.personal_email ?? '')
  const [empId,            setEmpId]          = useState(user.emp_id ?? '')
  const [msId,             setMsId]           = useState(user.ms_id ?? '')
  const [oneFormaId,       setOneFormaId]     = useState(user.one_forma_id ?? '')

  // Tab 2: Employment
  const [role,             setRole]           = useState(user.role)
  const [empType,          setEmpType]        = useState(user.employee_type ?? '')
  const [roleDesignation,  setRoleDesignation] = useState(user.role_designation ?? '')
  const [centificType,     setCentificType]   = useState(user.centific_type ?? '')
  const [locale,           setLocale]         = useState(user.locale ?? '')
  const [workflow,         setWorkflow]       = useState(user.workflow ?? '')
  const [startDate,        setStartDate]      = useState(user.start_date ?? '')
  const [batch,            setBatch]          = useState(user.batch ?? '')
  const [billable,         setBillable]       = useState(user.billable ?? false)
  const [isActive,         setIsActive]       = useState(user.is_active)
  const [password,         setPassword]       = useState('')

  // Tab 3: Onboarding & Status
  const [overallStatus,    setOverallStatus]  = useState(user.overall_status ?? '')
  const [msAccountStatus,  setMsAccountStatus] = useState(user.ms_account_status ?? '')
  const [phoneStatus,      setPhoneStatus]    = useState(user.phone_status ?? '')
  const [laptopStatus,     setLaptopStatus]   = useState(user.laptop_status ?? '')
  const [bgcRequestDate,   setBgcRequestDate] = useState(user.bgc_request_date ?? '')
  const [bgcStatus,        setBgcStatus]      = useState(user.bgc_status ?? '')
  const [identityCheckDate, setIdentityCheckDate] = useState(user.identity_check_date ?? '')

  // Tab 4: Contact & Notes
  const [phone,            setPhone]          = useState(user.phone ?? '')
  const [shippingAddress,  setShippingAddress] = useState(user.shipping_address ?? '')
  const [remarks,          setRemarks]        = useState(user.remarks ?? '')

  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [deleting,       setDeleting]       = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)

    const body: Record<string, unknown> = { id: user.id }

    // Helper to diff nullable string fields
    const diffStr = (val: string, orig: string | null, key: string) => {
      const v = val || null
      if (v !== orig) body[key] = v
    }
    const diffBool = (val: boolean, orig: boolean | null | undefined, key: string) => {
      if (val !== (orig ?? false)) body[key] = val
    }

    // Identity
    if (name  !== user.name)  body.name  = name
    if (email !== user.email) body.email = email
    diffStr(vMicrosoftEmail, user.v_microsoft_email, 'vMicrosoftEmail')
    diffStr(personalEmail,   user.personal_email,    'personalEmail')
    diffStr(empId,           user.emp_id,            'empId')
    diffStr(msId,            user.ms_id,             'msId')
    diffStr(oneFormaId,      user.one_forma_id,      'oneFormaId')

    // Employment
    if (role !== user.role) body.role = role
    diffStr(empType,         user.employee_type,     'employeeType')
    diffStr(roleDesignation, user.role_designation,  'roleDesignation')
    diffStr(centificType,    user.centific_type,     'centificType')
    diffStr(locale,          user.locale,            'locale')
    diffStr(workflow,        user.workflow,           'workflow')
    diffStr(startDate,       user.start_date,        'startDate')
    diffStr(batch,           user.batch,             'batch')
    diffBool(billable,       user.billable,          'billable')
    if (isActive !== user.is_active) body.isActive = isActive
    if (password) body.password = password

    // Onboarding & Status
    diffStr(overallStatus,   user.overall_status,    'overallStatus')
    diffStr(msAccountStatus, user.ms_account_status, 'msAccountStatus')
    diffStr(phoneStatus,     user.phone_status,      'phoneStatus')
    diffStr(laptopStatus,    user.laptop_status,     'laptopStatus')
    diffStr(bgcRequestDate,  user.bgc_request_date,  'bgcRequestDate')
    diffStr(bgcStatus,       user.bgc_status,        'bgcStatus')
    diffStr(identityCheckDate, user.identity_check_date, 'identityCheckDate')

    // Contact & Notes
    diffStr(phone,           user.phone,             'phone')
    diffStr(shippingAddress, user.shipping_address,  'shippingAddress')
    diffStr(remarks,         user.remarks,           'remarks')

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
      employee_type:       empType          || null,
      locale:              locale           || null,
      workflow:            workflow         || null,
      is_active:           isActive,
      emp_id:              empId            || null,
      v_microsoft_email:   vMicrosoftEmail  || null,
      ms_id:               msId             || null,
      one_forma_id:        oneFormaId       || null,
      personal_email:      personalEmail    || null,
      phone:               phone            || null,
      shipping_address:    shippingAddress  || null,
      start_date:          startDate        || null,
      batch:               batch            || null,
      centific_type:       centificType     || null,
      role_designation:    roleDesignation  || null,
      billable:            billable,
      overall_status:      overallStatus    || null,
      ms_account_status:   msAccountStatus  || null,
      phone_status:        phoneStatus      || null,
      laptop_status:       laptopStatus     || null,
      bgc_request_date:    bgcRequestDate   || null,
      bgc_status:          bgcStatus        || null,
      identity_check_date: identityCheckDate || null,
      remarks:             remarks          || null,
    })
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'identity',   label: 'Identity'   },
    { id: 'employment', label: 'Employment' },
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'contact',    label: 'Contact'    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Edit user</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pb-1 flex-shrink-0 border-b border-gray-100">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab body — scrollable */}
        <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* ── Tab 1: Identity ── */}
            {tab === 'identity' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name *">
                    <input value={name} onChange={e => setName(e.target.value)} required className={inputCls} />
                  </Field>
                  <Field label="Centific email *">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="v-Microsoft email">
                    <input value={vMicrosoftEmail} onChange={e => setVMicrosoftEmail(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Personal email">
                    <input type="email" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Emp ID">
                    <input value={empId} onChange={e => setEmpId(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="MS ID">
                    <input value={msId} onChange={e => setMsId(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="One Forma ID">
                    <input value={oneFormaId} onChange={e => setOneFormaId(e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div>
                  <Field label="New password">
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 6 chars — leave blank to keep current"
                      autoComplete="new-password"
                      className={inputCls}
                    />
                  </Field>
                </div>
              </>
            )}

            {/* ── Tab 2: Employment ── */}
            {tab === 'employment' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Role">
                    <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="Employee type">
                    <select value={empType} onChange={e => setEmpType(e.target.value)} className={inputCls}>
                      <option value="">— none —</option>
                      {EMPLOYEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Role designation">
                    <input value={roleDesignation} onChange={e => setRoleDesignation(e.target.value)} placeholder="e.g. Language Lead, Annotator…" className={inputCls} />
                  </Field>
                  <Field label="Centific type">
                    <input value={centificType} onChange={e => setCentificType(e.target.value)} placeholder="Employee / Vendor / Crowd" className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Locale">
                    <select value={locale} onChange={e => setLocale(e.target.value)} className={inputCls}>
                      <option value="">— Management —</option>
                      {locales.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Workflow">
                    <input value={workflow} onChange={e => setWorkflow(e.target.value)} placeholder="e.g. DMO, DAX…" className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date in Centific">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Batch / Onboarding day">
                    <input value={batch} onChange={e => setBatch(e.target.value)} placeholder="e.g. Batch 3" className={inputCls} />
                  </Field>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Billable</p>
                    <p className="text-xs text-gray-400">Count this user toward billable headcount</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBillable(v => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${billable ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${billable ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
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
              </>
            )}

            {/* ── Tab 3: Onboarding & Status ── */}
            {tab === 'onboarding' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Overall Status">
                    <input value={overallStatus} onChange={e => setOverallStatus(e.target.value)} placeholder="e.g. Onboarded" className={inputCls} />
                  </Field>
                  <Field label="MS Account Status">
                    <input value={msAccountStatus} onChange={e => setMsAccountStatus(e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone status">
                    <input value={phoneStatus} onChange={e => setPhoneStatus(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Laptop Status">
                    <input value={laptopStatus} onChange={e => setLaptopStatus(e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="BGC Request Date">
                    <input type="date" value={bgcRequestDate} onChange={e => setBgcRequestDate(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="BGC Status">
                    <input value={bgcStatus} onChange={e => setBgcStatus(e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <Field label="Identity check date">
                  <input type="date" value={identityCheckDate} onChange={e => setIdentityCheckDate(e.target.value)} className={inputCls} />
                </Field>
              </>
            )}

            {/* ── Tab 4: Contact & Notes ── */}
            {tab === 'contact' && (
              <>
                <Field label="Phone">
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" className={inputCls} />
                </Field>
                <Field label="Shipping address">
                  <textarea
                    value={shippingAddress}
                    onChange={e => setShippingAddress(e.target.value)}
                    rows={3}
                    className={inputCls}
                    placeholder="Street, city, country…"
                  />
                </Field>
                <Field label="Remarks">
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    rows={4}
                    className={inputCls}
                    placeholder="Internal notes…"
                  />
                </Field>
              </>
            )}
          </div>

          {/* Footer — always visible */}
          <div className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-gray-100">
            {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2 mb-3">{error}</p>}

            {confirmDelete ? (
              <div className="space-y-3">
                <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                  This will permanently delete <span className="font-semibold">{user.name}</span>. This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true)
                      const res = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE' })
                      if (!res.ok) {
                        const d = await res.json()
                        setError(d.error ?? 'Delete failed')
                        setDeleting(false)
                        setConfirmDelete(false)
                        return
                      }
                      onDeleted(user.id)
                    }}
                    className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete permanently'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
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
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
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

  function handleDeleted(id: string) {
    setUsers(prev => prev.filter(u => u.id !== id))
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
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-50">
                            <th className="text-left px-5 py-2 text-xs font-medium text-gray-400 w-40">Name</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">Centific email</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-24">Role</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-20">Type</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-20">Locale</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-20">Emp ID</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-24">Status</th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-400 w-16 text-center">Active</th>
                            <th className="px-3 py-2 w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {group.users.map(u => (
                            <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                              <td className="px-5 py-2.5 font-medium text-gray-900 whitespace-nowrap">{u.name}</td>
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
                              <td className="px-3 py-2.5 text-xs text-gray-500">{u.emp_id ?? '—'}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-500">{u.overall_status ?? '—'}</td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`inline-block w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-red-400'}`} title={u.is_active ? 'Active' : 'Inactive'} />
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
                    </div>
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
          onDeleted={handleDeleted}
          onClose={() => setEditing(null)}
        />
      )}
    </AppLayout>
  )
}

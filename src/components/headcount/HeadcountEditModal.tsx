'use client'

import { useState, useEffect } from 'react'
import { X, Check, Loader2, AlertTriangle, KeyRound } from 'lucide-react'
import { HeadcountRecord } from '@/lib/headcount-types'

interface HeadcountEditModalProps {
  record: HeadcountRecord
  onClose: () => void
  onSaved: (updated: HeadcountRecord) => void
}

// Field groups, ordered for the form
const GROUPS: Array<{
  label: string
  fields: Array<{
    key: keyof HeadcountRecord
    label: string
    type?: 'text' | 'date' | 'textarea' | 'email' | 'select'
    options?: string[]
    cols?: 1 | 2
  }>
}> = [
  {
    label: 'Identity',
    fields: [
      { key: 'name',         label: 'Name',              type: 'text',   cols: 2 },
      { key: 'locale',       label: 'Locale',            type: 'select', options: ['en_GB','de_DE','nl_NL','fr_FR','da_DK','nb_NO','fi_FI','sv_SE','no_NO','dk_DK','N/A'] },
      { key: 'role',         label: 'Access Role',       type: 'select', options: ['admin','lead','fte','freelancer'] },
      { key: 'position',     label: 'Position (Job Title)', type: 'select', options: ['Annotator','SME','Language Lead','Management','N/A'] },
      { key: 'workflow',     label: 'Workflow',          type: 'select', options: ['Transcriber','Scriber','Lead','N/A'] },
      { key: 'resourceType', label: 'Resource Type',     type: 'select', options: ['FTE','Freelancer','Management'] },
    ],
  },
  {
    label: 'Status',
    fields: [
      { key: 'status',           label: 'Resource Status',   type: 'select', options: ['Active','Inactive','Offboarded'] },
      { key: 'onboardingStatus', label: 'Onboarding Status', type: 'select', options: ['Onboarded','Pending','In Progress'] },
      { key: 'startDate',        label: 'Start Date',        type: 'date' },
      { key: 'idCheckDate',      label: 'ID Check Date',     type: 'text' },
      { key: 'inactiveDate',     label: 'Inactive Date',     type: 'date' },
    ],
  },
  {
    label: 'Contact',
    fields: [
      { key: 'centificEmail',   label: 'Centific Email (login)', type: 'email' },
      { key: 'personalEmail',   label: 'Personal Email',         type: 'email' },
      { key: 'vMicrosoftEmail', label: 'MS Email',               type: 'email' },
      { key: 'phoneNumber',     label: 'Phone Number',           type: 'text' },
      { key: 'shippingAddress', label: 'Shipping Address',       type: 'textarea', cols: 2 },
    ],
  },
  {
    label: 'IDs & Equipment',
    fields: [
      { key: 'empId',        label: 'Emp ID (FTE only)', type: 'text' },
      { key: 'msId',         label: 'MS Personnel ID',   type: 'text' },
      { key: 'oneFormaId',   label: 'OneForma 2.0 ID',   type: 'text' },
      { key: 'phoneVersion', label: 'Phone Version',     type: 'text' },
      { key: 'laptopType',   label: 'Laptop Type',       type: 'select', options: ['Refurbished','Centific','Personal','Pending','NA'] },
    ],
  },
  {
    label: 'Notes',
    fields: [
      { key: 'remarks', label: 'Remarks', type: 'textarea', cols: 2 },
    ],
  },
]

export function HeadcountEditModal({ record, onClose, onSaved }: HeadcountEditModalProps) {
  const [form,        setForm]        = useState<HeadcountRecord>(record)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting,   setResetting]   = useState(false)
  const [resetMsg,    setResetMsg]    = useState<string | null>(null)
  const [resetError,  setResetError]  = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function update<K extends keyof HeadcountRecord>(key: K, val: HeadcountRecord[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function save() {
    setSaving(true); setError(null)

    const patch: Partial<HeadcountRecord> = {}
    for (const group of GROUPS) {
      for (const f of group.fields) {
        if (form[f.key] !== record[f.key]) {
          ;(patch as Record<string, unknown>)[f.key] = form[f.key]
        }
      }
    }

    if (Object.keys(patch).length === 0) {
      setSaving(false); onClose(); return
    }

    try {
      const res = await fetch('/api/headcount', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id, patch }),
      })
      setSaving(false)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Save failed — HTTP ${res.status}`)
        return
      }

      const data = await res.json()
      onSaved(data.record)
      onClose()
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Network error — could not reach the server.')
    }
  }

  async function resetPassword() {
    if (newPassword.length < 8) return
    setResetting(true); setResetMsg(null); setResetError(null)
    try {
      const res = await fetch('/api/admin/headcount/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id, password: newPassword }),
      })
      setResetting(false)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setResetError(d.error ?? `Reset failed — HTTP ${res.status}`)
        return
      }
      setNewPassword('')
      setResetMsg('Password reset successfully.')
    } catch (err) {
      setResetting(false)
      setResetError(err instanceof Error ? err.message : 'Network error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Edit headcount record</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {record.name} · <span className="font-mono">{record.id}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Save failed</p>
                <p className="text-xs text-red-700 mt-0.5 font-mono break-all">{error}</p>
              </div>
            </div>
          )}

          {GROUPS.map(group => (
            <section key={group.label}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                {group.label}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {group.fields.map(f => {
                  const v = (form[f.key] ?? '') as string
                  const span = f.cols === 2 ? 'col-span-2' : 'col-span-1'

                  if (f.type === 'select' && f.options) {
                    return (
                      <div key={f.key} className={span}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                        <select
                          value={v}
                          onChange={e => update(f.key, (e.target.value || null) as HeadcountRecord[typeof f.key])}
                          className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">—</option>
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    )
                  }

                  if (f.type === 'textarea') {
                    return (
                      <div key={f.key} className={span}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                        <textarea
                          value={v}
                          onChange={e => update(f.key, (e.target.value || null) as HeadcountRecord[typeof f.key])}
                          rows={2}
                          className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                    )
                  }

                  return (
                    <div key={f.key} className={span}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input
                        type={f.type ?? 'text'}
                        value={v}
                        onChange={e => update(f.key, (e.target.value || null) as HeadcountRecord[typeof f.key])}
                        className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )
                })}
              </div>
            </section>
          ))}

          {/* Portal Access — password reset */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Portal Access
            </h3>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-3">
                Reset this user&apos;s portal login password. They log in with their centific email.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="New password (min. 8 characters)"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setResetMsg(null); setResetError(null) }}
                  className="flex-1 text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={resetPassword}
                  disabled={resetting || newPassword.length < 8}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors inline-flex items-center gap-1.5"
                >
                  {resetting
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Resetting…</>
                    : 'Reset password'}
                </button>
              </div>
              {resetMsg   && <p className="text-xs mt-2 text-green-700">{resetMsg}</p>}
              {resetError && <p className="text-xs mt-2 text-red-600">{resetError}</p>}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <p className="text-xs text-slate-400">
            Saves to <code className="px-1 py-0.5 rounded bg-slate-200 text-slate-600 text-[11px]">accounts_credentials</code> in Supabase.
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-white"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                : <><Check className="w-3.5 h-3.5" /> Save changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

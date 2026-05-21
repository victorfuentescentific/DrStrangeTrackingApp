'use client'

import { useState, useEffect } from 'react'
import { X, Check, Loader2 } from 'lucide-react'
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
      { key: 'name',         label: 'Name',              type: 'text',  cols: 2 },
      { key: 'locale',       label: 'Locale',            type: 'select', options: ['en_GB','de_DE','nl_NL','fr_FR','da_DK','nb_NO','fi_FI','sv_SE','no_NO','dk_DK','N/A'] },
      { key: 'role',         label: 'Role',              type: 'select', options: ['Annotator','SME','Language Lead','Management'] },
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
      { key: 'centificEmail',   label: 'Centific Email',  type: 'email' },
      { key: 'personalEmail',   label: 'Personal Email',  type: 'email' },
      { key: 'vMicrosoftEmail', label: 'MS Email',        type: 'email' },
      { key: 'phoneNumber',     label: 'Phone Number',    type: 'text' },
      { key: 'shippingAddress', label: 'Shipping Address', type: 'textarea', cols: 2 },
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
  const [form,    setForm]    = useState<HeadcountRecord>(record)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Escape to close
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

    // Build patch of fields that actually changed
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

    const res = await fetch('/api/headcount', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: record.id, patch }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? `Save failed (HTTP ${res.status})`)
      return
    }
    const data = await res.json()
    onSaved(data.record)
    onClose()
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          {error
            ? <p className="text-sm text-red-600">{error}</p>
            : <p className="text-xs text-slate-400">Changes are persisted to the headcount table.</p>}
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

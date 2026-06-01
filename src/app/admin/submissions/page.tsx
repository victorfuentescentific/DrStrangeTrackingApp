'use client'

import { useEffect, useState, useCallback, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import {
  Pencil, Trash2, X, ChevronLeft, ChevronRight,
  AlertCircle, Loader2, Minus, Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailySubmissionRow {
  id:                    string
  userId:                string
  userName:              string
  userLocale:            string | null
  date:                  string
  locale:                string
  productionHours:       number
  productionComments:    string
  hasNonProduction:      boolean
  totalNonProductionHours: number
  npHours2pass:          number
  npHoursPhi:            number
  npHoursIAA:            number
  npHoursTraining:       number
  npHoursReview:         number
  npHoursWaiting:        number
  npHoursMeetings:       number
  npHoursIT:             number
  npHoursOther:          number
  otherWorkingRemarks:   string
  totalWorkingHours:     number
  remarks:               string
  miscCost:              number | null
  invoiceUrls:           string[]
  submittedAt:           string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round1(v: number) { return Math.round(v * 10) / 10 }

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function getDefaultRange() {
  const now  = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

// ─── NumInput ─────────────────────────────────────────────────────────────────

function NumInput({ value, onChange, min = 0, step = 0.5 }: {
  value: number; onChange: (v: number) => void; min?: number; step?: number
}) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(round1(Math.max(min, value - step)))}
        disabled={value <= min}
        className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors">
        <Minus className="w-3 h-3" />
      </button>
      <input type="number" value={value} min={min} step={step}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(round1(Math.max(min, v))) }}
        className="w-20 text-center text-xs border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-brand-400 tabular-nums" />
      <button type="button" onClick={() => onChange(round1(value + step))}
        className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({ sub, onSaved, onClose }: {
  sub: DailySubmissionRow; onSaved: () => void; onClose: () => void
}) {
  const [date,                    setDate]                    = useState(sub.date)
  const [locale,                  setLocale]                  = useState(sub.locale)
  const [productionHours,         setProductionHours]         = useState(sub.productionHours)
  const [productionComments,      setProductionComments]      = useState(sub.productionComments ?? '')
  const [hasNonProduction,        setHasNonProduction]        = useState(sub.hasNonProduction)
  const [totalNonProductionHours, setTotalNonProductionHours] = useState(sub.totalNonProductionHours)
  const [npHours2pass,            setNpHours2pass]            = useState(sub.npHours2pass)
  const [npHoursPhi,              setNpHoursPhi]              = useState(sub.npHoursPhi)
  const [npHoursIAA,              setNpHoursIAA]              = useState(sub.npHoursIAA ?? 0)
  const [npHoursTraining,         setNpHoursTraining]         = useState(sub.npHoursTraining)
  const [npHoursReview,           setNpHoursReview]           = useState(sub.npHoursReview)
  const [npHoursWaiting,          setNpHoursWaiting]          = useState(sub.npHoursWaiting ?? 0)
  const [npHoursMeetings,         setNpHoursMeetings]         = useState(sub.npHoursMeetings ?? 0)
  const [npHoursIT,               setNpHoursIT]               = useState(sub.npHoursIT ?? 0)
  const [otherWorkingRemarks,     setOtherWorkingRemarks]     = useState(sub.otherWorkingRemarks ?? '')
  const [remarks,                 setRemarks]                 = useState(sub.remarks)
  const [miscCost,                setMiscCost]                = useState(sub.miscCost !== null ? String(sub.miscCost) : '')
  const [saving,                  setSaving]                  = useState(false)
  const [error,                   setError]                   = useState('')

  const npSubtotal        = round1(npHours2pass + npHoursPhi + npHoursIAA + npHoursTraining + npHoursReview + npHoursWaiting + npHoursMeetings + npHoursIT)
  const npMatch           = Math.abs(npSubtotal - totalNonProductionHours) < 0.001
  const totalWorkingHours = round1(productionHours + (hasNonProduction ? totalNonProductionHours : 0))

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const parsedMiscCost = miscCost !== '' ? parseFloat(miscCost) : null

    const res = await fetch(`/api/daily-submissions?id=${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, locale,
        productionHours, productionComments,
        hasNonProduction,
        totalNonProductionHours: hasNonProduction ? totalNonProductionHours : 0,
        npHours2pass:    hasNonProduction ? npHours2pass    : 0,
        npHoursPhi:      hasNonProduction ? npHoursPhi      : 0,
        npHoursIAA:      hasNonProduction ? npHoursIAA      : 0,
        npHoursTraining: hasNonProduction ? npHoursTraining : 0,
        npHoursReview:   hasNonProduction ? npHoursReview   : 0,
        npHoursWaiting:  hasNonProduction ? npHoursWaiting  : 0,
        npHoursMeetings: hasNonProduction ? npHoursMeetings : 0,
        npHoursIT:       hasNonProduction ? npHoursIT       : 0,
        npHoursOther: 0,
        otherWorkingRemarks: hasNonProduction ? otherWorkingRemarks.trim() : '',
        totalWorkingHours,
        remarks,
        miscCost: parsedMiscCost,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? 'Failed to save')
      return
    }
    onSaved()
  }

  const LOCALES = ['en_GB', 'de_DE', 'nl_NL', 'fr_FR', 'da_DK', 'nb_NO', 'fi_FI', 'sv_SE']
  const inp = 'w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Edit Submission — {sub.userName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{fmtDate(sub.date)} · submitted {fmtTime(sub.submittedAt)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-5">

          {/* Date + Locale */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Locale</label>
              <select value={locale} onChange={e => setLocale(e.target.value)} className={inp}>
                {LOCALES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Production Hours */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Production Hours</p>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Hours</label>
              <NumInput value={productionHours} onChange={setProductionHours} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Production Comments</label>
              <textarea value={productionComments} onChange={e => setProductionComments(e.target.value)}
                rows={2} className={inp + ' resize-none'} />
            </div>
          </div>

          {/* Other-Working Hours toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Any Other-Working Hours?</label>
            <div className="flex gap-2">
              {([true, false] as const).map(val => (
                <button key={String(val)} type="button" onClick={() => setHasNonProduction(val)}
                  className={cn('flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all',
                    hasNonProduction === val
                      ? val ? 'bg-brand-500 border-brand-500 text-white' : 'bg-slate-700 border-slate-700 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300')}>
                  {val ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {/* OW breakdown */}
          {hasNonProduction && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Other-Working Hours Breakdown</p>
              <div>
                <label className="block text-xs text-amber-700 mb-1">Total Other-Working Hours</label>
                <NumInput value={totalNonProductionHours} onChange={setTotalNonProductionHours} />
                <div className={cn('mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                  npMatch ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                  {!npMatch && <AlertCircle className="w-3 h-3" />}
                  Sub-total: {npSubtotal} / {totalNonProductionHours} h {npMatch && '✓'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['2Pass',               npHours2pass,    setNpHours2pass   ],
                  ['PHI',                 npHoursPhi,      setNpHoursPhi     ],
                  ['IAA',                 npHoursIAA,      setNpHoursIAA     ],
                  ['Training',            npHoursTraining, setNpHoursTraining],
                  ['Review',              npHoursReview,   setNpHoursReview  ],
                  ['Waiting for Worksets',npHoursWaiting,  setNpHoursWaiting ],
                  ['Meetings',            npHoursMeetings, setNpHoursMeetings],
                  ['IT / NEAT Issues',    npHoursIT,       setNpHoursIT      ],
                ].map(([label, val, setter]) => (
                  <div key={label as string}>
                    <label className="block text-xs text-slate-500 mb-1">{label as string}</label>
                    <NumInput value={val as number} onChange={setter as (v: number) => void} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Other-Working Hours Remarks</label>
                <textarea value={otherWorkingRemarks} onChange={e => setOtherWorkingRemarks(e.target.value)}
                  rows={2} className="w-full px-3 py-1.5 text-xs border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none bg-white" />
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex items-baseline gap-1.5 px-4 py-3 bg-slate-50 rounded-xl">
            <span className="text-2xl font-bold text-slate-800 tabular-nums">{totalWorkingHours}h</span>
            <span className="text-sm text-slate-500">total working hours</span>
          </div>

          {/* Remarks + Misc */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Remarks</label>
              <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
                rows={2} className={inp + ' resize-none'} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Misc Cost (USD)</label>
              <input type="number" min="0" step="0.01" value={miscCost}
                onChange={e => setMiscCost(e.target.value)} placeholder="0.00" className={inp} />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-brand-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LOCALES = ['en_GB', 'de_DE', 'nl_NL', 'fr_FR', 'da_DK', 'nb_NO', 'fi_FI', 'sv_SE']
const PAGE_SIZE = 50

export default function AdminSubmissionsPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)

  const def = getDefaultRange()
  const [from,         setFrom]         = useState(def.from)
  const [to,           setTo]           = useState(def.to)
  const [filterLocale, setFilterLocale] = useState('')
  const [filterUser,   setFilterUser]   = useState('')

  const [subs,         setSubs]         = useState<DailySubmissionRow[]>([])
  const [loading,      setLoading]      = useState(false)
  const [page,         setPage]         = useState(0)

  const [editSub,      setEditSub]      = useState<DailySubmissionRow | null>(null)
  const [deleteSub,    setDeleteSub]    = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  // Auth — admin or pm only
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => { if (r.status === 401) { router.push('/login'); return null } return r.json() })
      .then((d: { user: { role: string } } | null) => {
        if (!d) return
        if (d.user.role !== 'admin' && d.user.role !== 'pm') { router.push('/'); return }
        setAuthed(true)
      })
      .catch(() => router.push('/login'))
  }, [router])

  const fetchSubs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ from, to })
    const res    = await fetch(`/api/daily-submissions?${params}`)
    const data   = await res.json() as DailySubmissionRow[]
    setSubs(Array.isArray(data) ? data : [])
    setPage(0)
    setLoading(false)
  }, [from, to])

  useEffect(() => { if (authed) void fetchSubs() }, [authed, fetchSubs])

  // Client-side filter by name/locale
  const filtered = subs.filter(s => {
    if (filterLocale && s.locale !== filterLocale) return false
    if (filterUser && !s.userName.toLowerCase().includes(filterUser.toLowerCase())) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  async function handleDelete(id: string) {
    setDeleting(true)
    await fetch(`/api/daily-submissions?id=${id}`, { method: 'DELETE' })
    setDeleting(false); setDeleteSub(null)
    void fetchSubs()
  }

  // Summary stats
  const totalProd  = round1(filtered.reduce((a, s) => a + s.productionHours,       0))
  const totalOW    = round1(filtered.reduce((a, s) => a + s.totalNonProductionHours, 0))
  const totalHours = round1(filtered.reduce((a, s) => a + s.totalWorkingHours,      0))

  if (!authed) return null

  return (
    <AppLayout title="Hours Submissions" subtitle="Daily Hours Submission Form — all entries">
      <div className="space-y-5">

        {/* ── Filters ─────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Locale</label>
              <select value={filterLocale} onChange={e => setFilterLocale(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">All</option>
                {LOCALES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">User</label>
              <input type="text" placeholder="Search name…" value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-40" />
            </div>
            <button onClick={() => void fetchSubs()}
              className="px-4 py-1.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors">
              Apply
            </button>
          </div>
        </div>

        {/* ── Summary cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Submissions',     value: filtered.length,      color: 'text-slate-800' },
            { label: 'Production h',    value: totalProd,            color: 'text-brand-600' },
            { label: 'Other-Working h', value: totalOW,              color: 'text-amber-600' },
            { label: 'Total h',         value: totalHours,           color: 'text-slate-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Table ───────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Locale</th>
                  <th className="px-4 py-3 text-right">Prod h</th>
                  <th className="px-4 py-3 text-right">OW h</th>
                  <th className="px-4 py-3 text-right">Total h</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Submitted</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">
                    No submissions found for this period.
                  </td></tr>
                ) : paged.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 whitespace-nowrap">{s.userName}</p>
                      <p className="text-[11px] text-slate-400">{s.userLocale ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 text-xs">{fmtDate(s.date)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.locale}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-brand-700 font-medium">{s.productionHours}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700 font-medium">{s.totalNonProductionHours}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-800">{s.totalWorkingHours}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate" title={s.remarks}>{s.remarks || '—'}</td>
                    <td className="px-4 py-3 text-right text-[11px] text-slate-400 whitespace-nowrap">{fmtTime(s.submittedAt)}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditSub(s)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteSub(s.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-500">{filtered.length} submission{filtered.length !== 1 ? 's' : ''}</p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40">
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                  className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editSub && (
        <EditModal sub={editSub} onClose={() => setEditSub(null)}
          onSaved={() => { setEditSub(null); void fetchSubs() }} />
      )}

      {/* Delete confirm */}
      {deleteSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="font-semibold text-slate-800">Delete this submission?</p>
            <p className="text-sm text-slate-500">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => void handleDelete(deleteSub)} disabled={deleting}
                className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => setDeleteSub(null)}
                className="flex-1 border border-slate-200 rounded-lg py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

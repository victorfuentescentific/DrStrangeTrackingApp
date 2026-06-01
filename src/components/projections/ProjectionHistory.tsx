'use client'

import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ClipboardList, Loader2, AlertTriangle, RefreshCw, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { get1PRate } from '@/lib/eta-calculator'
import type { WorkflowType } from '@/lib/types'

// ─── Shared constants (kept in sync with ProductionCalculator) ────────────────

const P2_HC: Record<string, number> = {
  en_GB: 3,
  de_DE: 4,
  fr_FR: 4,
  nl_NL: 4,
}
const DEFAULT_P2_HC  = 4
const HOURS_PER_DAY  = 8
const BUFFER         = 0.80

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalcSession {
  id:              string
  locale:          string
  workflow:        string
  hc:              number
  total_hours:     number
  iaa_days:        number
  p2_days:         number
  phi_days:        number
  rev_days:        number
  output_full:     number
  output_buffered: number
  unit:            string
  label:           string | null
  date_from:       string | null
  date_to:         string | null
  created_at:      string
}

interface EditDraft {
  locale:          string
  workflow:        string
  hc:              string
  total_hours:     string
  iaa_days:        string
  p2_days:         string
  phi_days:        string
  rev_days:        string
  output_full:     string
  output_buffered: string
  unit:            string
  label:           string
  date_from:       string
  date_to:         string
}

const UNITS = ['min audio', 'rep', 'WU'] as const

const UNIT_BADGE: Record<string, string> = {
  'min audio': 'bg-indigo-100 text-indigo-700',
  'rep':       'bg-amber-100  text-amber-700',
  'WU':        'bg-emerald-100 text-emerald-700',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return format(new Date(iso + 'T12:00:00'), 'dd MMM yyyy')
}

function fmtRange(from: string | null, to: string | null): string {
  if (!from && !to) return '—'
  if (from && to)   return `${fmtDate(from)} → ${fmtDate(to)}`
  if (from)         return `from ${fmtDate(from)}`
  return `until ${fmtDate(to)}`
}

function sessionToDraft(s: CalcSession): EditDraft {
  return {
    locale:          s.locale,
    workflow:        s.workflow,
    hc:              String(s.hc),
    total_hours:     String(s.total_hours),
    iaa_days:        String(s.iaa_days),
    p2_days:         String(s.p2_days),
    phi_days:        String(s.phi_days),
    rev_days:        String(s.rev_days ?? 0),
    output_full:     String(s.output_full),
    output_buffered: String(s.output_buffered),
    unit:            s.unit,
    label:           s.label ?? '',
    date_from:       s.date_from ?? '',
    date_to:         s.date_to   ?? '',
  }
}

/** Recalculate output_full and output_buffered from a draft's inputs. */
function recalcOutputs(d: EditDraft): { output_full: string; output_buffered: string } {
  const hc         = parseFloat(d.hc)         || 0
  const totalHours = parseFloat(d.total_hours) || 0
  const iaaDays    = parseFloat(d.iaa_days)    || 0
  const p2Days     = parseFloat(d.p2_days)     || 0
  const phiDays    = parseFloat(d.phi_days)    || 0
  const revDays    = parseFloat(d.rev_days)    || 0
  const p2Hc       = P2_HC[d.locale] ?? DEFAULT_P2_HC

  const iaaHours   = hc   * HOURS_PER_DAY * iaaDays
  const p2Hours    = p2Hc * HOURS_PER_DAY * p2Days
  const phiHours   = hc   * HOURS_PER_DAY * phiDays
  const revHours   = hc   * HOURS_PER_DAY * revDays
  const consumed   = iaaHours + p2Hours + phiHours + revHours
  const remaining  = Math.max(0, totalHours - consumed)
  const rate       = get1PRate(d.workflow as WorkflowType, d.locale) / HOURS_PER_DAY
  const output     = Math.round(remaining * rate)

  return {
    output_full:     String(output),
    output_buffered: String(Math.round(output * BUFFER)),
  }
}

// Fields that drive the auto-recalculation
const CALC_FIELDS = ['hc', 'total_hours', 'iaa_days', 'p2_days', 'phi_days', 'rev_days', 'locale', 'workflow'] as const

// ─── Filter pill ──────────────────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors',
        active
          ? 'bg-brand-600 text-white border-brand-600'
          : 'bg-white text-slate-600 border-slate-200 hover:border-brand-400',
      )}
    >
      {label}
    </button>
  )
}

// ─── Shared input styles ───────────────────────────────────────────────────────

const BASE_INPUT = 'w-full px-2 py-1 text-xs border border-brand-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500'

// ─── Inline edit row ──────────────────────────────────────────────────────────

interface EditRowProps {
  draft:    EditDraft
  saving:   boolean
  createdAt: string
  onChange: (draft: EditDraft) => void
  onSave:   () => void
  onCancel: () => void
}

function EditRow({ draft, saving, createdAt, onChange, onSave, onCancel }: EditRowProps) {
  function set<K extends keyof EditDraft>(field: K, value: EditDraft[K]) {
    onChange({ ...draft, [field]: value })
  }

  return (
    <tr className="bg-brand-50/30 border-l-2 border-brand-500">

      {/* Date saved — read-only */}
      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
        {format(new Date(createdAt), 'dd MMM yyyy HH:mm')}
      </td>

      {/* Locale */}
      <td className="px-3 py-3 min-w-[90px]">
        <input type="text" value={draft.locale}
          onChange={e => set('locale', e.target.value)}
          placeholder="e.g. en_GB" className={BASE_INPUT} />
      </td>

      {/* Workflow */}
      <td className="px-3 py-3 min-w-[110px]">
        <input type="text" value={draft.workflow}
          onChange={e => set('workflow', e.target.value)}
          placeholder="Workflow" className={BASE_INPUT} />
      </td>

      {/* HC */}
      <td className="px-3 py-3 min-w-[56px]">
        <input type="number" min={0} step={1} value={draft.hc}
          onChange={e => set('hc', e.target.value)}
          className={`${BASE_INPUT} text-center`} />
      </td>

      {/* Total hours */}
      <td className="px-3 py-3 min-w-[64px]">
        <input type="number" min={0} step={0.5} value={draft.total_hours}
          onChange={e => set('total_hours', e.target.value)}
          className={`${BASE_INPUT} text-center`} />
      </td>

      {/* IAA days */}
      <td className="px-3 py-3 min-w-[56px]">
        <input type="number" min={0} step={1} value={draft.iaa_days}
          onChange={e => set('iaa_days', e.target.value)}
          className={`${BASE_INPUT} text-center`} />
      </td>

      {/* Review days */}
      <td className="px-3 py-3 min-w-[56px]">
        <input type="number" min={0} step={1} value={draft.rev_days}
          onChange={e => set('rev_days', e.target.value)}
          className={`${BASE_INPUT} text-center`} />
      </td>

      {/* 2P days */}
      <td className="px-3 py-3 min-w-[56px]">
        <input type="number" min={0} step={1} value={draft.p2_days}
          onChange={e => set('p2_days', e.target.value)}
          className={`${BASE_INPUT} text-center`} />
      </td>

      {/* PHI days */}
      <td className="px-3 py-3 min-w-[56px]">
        <input type="number" min={0} step={1} value={draft.phi_days}
          onChange={e => set('phi_days', e.target.value)}
          className={`${BASE_INPUT} text-center`} />
      </td>

      {/* 1P Output — auto-recalculated, still editable */}
      <td className="px-3 py-3 min-w-[80px]">
        <input type="number" min={0} step={1} value={draft.output_full}
          onChange={e => set('output_full', e.target.value)}
          className={`${BASE_INPUT} text-right font-bold`} />
      </td>

      {/* Buffered — auto-recalculated, still editable */}
      <td className="px-3 py-3 min-w-[80px]">
        <input type="number" min={0} step={1} value={draft.output_buffered}
          onChange={e => set('output_buffered', e.target.value)}
          className={`${BASE_INPUT} text-right`} />
      </td>

      {/* Unit */}
      <td className="px-3 py-3 min-w-[90px]">
        <select value={draft.unit} onChange={e => set('unit', e.target.value)} className={BASE_INPUT}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>

      {/* Label */}
      <td className="px-3 py-3 min-w-[140px]">
        <input type="text" value={draft.label}
          onChange={e => set('label', e.target.value)}
          maxLength={120} placeholder="Label…" className={BASE_INPUT} />
      </td>

      {/* Production window */}
      <td className="px-5 py-3 min-w-[220px]">
        <div className="flex items-center gap-1.5">
          <input type="date" value={draft.date_from}
            onChange={e => set('date_from', e.target.value)}
            className="flex-1 px-2 py-1 text-xs border border-brand-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500" />
          <span className="text-slate-400 text-xs shrink-0">→</span>
          <input type="date" value={draft.date_to}
            min={draft.date_from || undefined}
            onChange={e => set('date_to', e.target.value)}
            className="flex-1 px-2 py-1 text-xs border border-brand-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </div>
      </td>

      {/* Actions */}
      <td className="px-3 py-3 text-right whitespace-nowrap">
        <button onClick={onSave} disabled={saving} title="Save"
          className="inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-semibold rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors mr-1">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save
        </button>
        <button onClick={onCancel} title="Cancel"
          className="inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-semibold rounded bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          <X className="w-3 h-3" />
          Cancel
        </button>
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectionHistory({ role, userLocale }: { role: string; userLocale?: string | null }) {
  const isAdmin   = role === 'admin'
  const isPm      = role === 'pm'
  const isLead    = role === 'lead'
  const canSeeAll = isAdmin || isPm                   // sees every session
  const canEdit   = isAdmin                           // PATCH endpoint is admin-only
  const [sessions,       setSessions]       = useState<CalcSession[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [localeFilter,   setLocaleFilter]   = useState<string>('all')
  const [workflowFilter, setWorkflowFilter] = useState<string>('all')

  const blankDraft: EditDraft = {
    locale: '', workflow: '', hc: '0', total_hours: '0',
    iaa_days: '0', p2_days: '0', phi_days: '0', rev_days: '0',
    output_full: '0', output_buffered: '0', unit: 'min audio',
    label: '', date_from: '', date_to: '',
  }

  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editDraft,  setEditDraft]  = useState<EditDraft>(blankDraft)
  const [editSaving, setEditSaving] = useState(false)
  const [editError,  setEditError]  = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    fetch('/api/calculator-sessions')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d  => { setSessions(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Network error'); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const allLocales   = useMemo(() => [...new Set(sessions.map(s => s.locale))].sort(),   [sessions])
  const allWorkflows = useMemo(() => [...new Set(sessions.map(s => s.workflow))].sort(), [sessions])

  const filtered = useMemo(
    () => sessions.filter(
      s =>
        (localeFilter   === 'all' || s.locale   === localeFilter) &&
        (workflowFilter === 'all' || s.workflow === workflowFilter),
    ),
    [sessions, localeFilter, workflowFilter],
  )

  function startEdit(s: CalcSession) {
    setEditingId(s.id)
    setEditDraft(sessionToDraft(s))
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  /** When a calculation-driving field changes, auto-update output_full / output_buffered. */
  function handleDraftChange(newDraft: EditDraft) {
    const calcChanged = CALC_FIELDS.some(f => newDraft[f] !== editDraft[f])
    if (calcChanged) {
      const recalculated = recalcOutputs(newDraft)
      setEditDraft({ ...newDraft, ...recalculated })
    } else {
      setEditDraft(newDraft)
    }
  }

  async function saveEdit() {
    if (!editingId) return
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/calculator-sessions/${editingId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale:          editDraft.locale.trim(),
          workflow:        editDraft.workflow.trim(),
          hc:              parseFloat(editDraft.hc)              || 0,
          total_hours:     parseFloat(editDraft.total_hours)     || 0,
          iaa_days:        parseFloat(editDraft.iaa_days)        || 0,
          p2_days:         parseFloat(editDraft.p2_days)         || 0,
          phi_days:        parseFloat(editDraft.phi_days)        || 0,
          rev_days:        parseFloat(editDraft.rev_days)        || 0,
          output_full:     parseFloat(editDraft.output_full)     || 0,
          output_buffered: parseFloat(editDraft.output_buffered) || 0,
          unit:            editDraft.unit,
          label:           editDraft.label.trim()     || null,
          date_from:       editDraft.date_from.trim() || null,
          date_to:         editDraft.date_to.trim()   || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error ?? `Save failed (HTTP ${res.status})`)
      } else {
        setSessions(prev => prev.map(s => s.id === editingId ? { ...s, ...data } : s))
        setEditingId(null)
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-brand-500" />
          <h2 className="text-sm font-bold text-slate-800">Production Calculator Log</h2>
          {canEdit && (
            <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full">
              Admin — click ✏ to edit a row
            </span>
          )}
          {isPm && (
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              Management view — all locales
            </span>
          )}
          {isLead && userLocale && (
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              Lead view — {userLocale} only
            </span>
          )}
        </div>
        <button onClick={load} disabled={loading}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="Refresh">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* ── Errors ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </div>
      )}
      {editError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />Edit failed: {editError}
        </div>
      )}

      {/* ── Filters ── */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">Locale:</span>
          {['all', ...allLocales].map(l => (
            <Pill key={l} label={l === 'all' ? 'All' : l} active={localeFilter === l} onClick={() => setLocaleFilter(l)} />
          ))}
          <span className="text-[11px] font-semibold text-slate-500 shrink-0 ml-3">Workflow:</span>
          {['all', ...allWorkflows].map(w => (
            <Pill key={w} label={w === 'all' ? 'All' : w} active={workflowFilter === w} onClick={() => setWorkflowFilter(w)} />
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && !sessions.length && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading log…</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && sessions.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">No saved calculations yet</p>
          <p className="text-slate-400 text-xs mt-1.5">
            Save a calculation from the <strong>Production Calculator</strong> tab.
          </p>
        </div>
      )}

      {/* ── Log table ── */}
      {filtered.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left   px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">Date saved</th>
                <th className="text-left   px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Locale</th>
                <th className="text-left   px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Workflow</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">HC</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hours</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">IAA</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">REV</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">2P</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">PHI</th>
                <th className="text-right  px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">1P Output</th>
                <th className="text-right  px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Buffered</th>
                <th className="text-left   px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Unit</th>
                <th className="text-left   px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Label</th>
                <th className="text-left   px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">Production window</th>
                {canEdit && <th className="px-3 py-2.5 w-24" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => {
                const isEditing = canEdit && editingId === s.id

                if (isEditing) {
                  return (
                    <EditRow
                      key={s.id}
                      createdAt={s.created_at}
                      draft={editDraft}
                      saving={editSaving}
                      onChange={handleDraftChange}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                    />
                  )
                }

                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {format(new Date(s.created_at), 'dd MMM yyyy HH:mm')}
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-700">{s.locale}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">{s.workflow}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-600">{s.hc}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-600">{s.total_hours}h</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-400">{s.iaa_days > 0 ? `${s.iaa_days}d` : '—'}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-400">{(s.rev_days ?? 0) > 0 ? `${s.rev_days}d` : '—'}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-400">{s.p2_days  > 0 ? `${s.p2_days}d`  : '—'}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-400">{s.phi_days > 0 ? `${s.phi_days}d` : '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-xs font-bold text-slate-800">{s.output_full.toLocaleString()}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-slate-500">
                      {s.output_buffered > 0 ? s.output_buffered.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                        UNIT_BADGE[s.unit] ?? 'bg-slate-100 text-slate-500')}>
                        {s.unit}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 max-w-[140px] truncate">
                      {s.label ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-xs whitespace-nowrap">
                      {s.date_from || s.date_to ? (
                        <span className="text-brand-700 font-medium">{fmtRange(s.date_from, s.date_to)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => startEdit(s)}
                          disabled={editingId !== null}
                          title="Edit row"
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded border border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-600 bg-white disabled:opacity-30"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="px-5 py-2 border-t border-slate-100">
            <p className="text-[11px] text-slate-400">
              {filtered.length < sessions.length
                ? `Showing ${filtered.length} of ${sessions.length} sessions`
                : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} total`}
            </p>
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && sessions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-400 text-xs">No sessions match the current filters.</p>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        {canSeeAll
          ? 'Full record of all production calculations saved by the entire team, newest first.'
          : isLead && userLocale
            ? `Full record of all production calculations saved by ${userLocale} team members, newest first.`
            : 'Full record of all production calculations saved by you, newest first.'}
        {canEdit && ' Admins can edit any field by clicking ✏ on a row. Changing days auto-recalculates the output.'}
      </p>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useMemo, type JSX } from 'react'
import { format } from 'date-fns'
import { BarChart3, Loader2, AlertTriangle, PlusCircle, Check, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { weekStart } from '@/lib/projections'
import type { Actual, Snapshot } from '@/lib/projection-store'

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCALES   = ['en_GB', 'de_DE', 'nl_NL', 'fr_FR', 'da_DK', 'nb_NO', 'fi_FI', 'sv_SE']
const WORKFLOWS = ['DAX', 'DMO', 'Scribing']
const UNITS     = ['min audio', 'rep', 'WU'] as const
type Unit = typeof UNITS[number]

const UNIT_LABEL: Record<Unit, string> = {
  'min audio': 'min audio',
  'rep':       'rep',
  'WU':        'WU',
}

function isoMonday(d: Date): string {
  return weekStart(d).toISOString().split('T')[0]
}

function fmtWeek(isoDate: string): string {
  return `W/C ${format(new Date(isoDate + 'T12:00:00'), 'd MMM yyyy')}`
}

function fmtNum(n: number): string {
  return n > 0 ? n.toLocaleString() : '—'
}

// ─── Delta badge ─────────────────────────────────────────────────────────────

function DeltaBadge({ actual, proj }: { actual: number; proj: number }): JSX.Element | null {
  if (!proj || !actual) return null
  const pct  = ((actual - proj) / proj) * 100
  const good = pct >= 0
  return (
    <span className={cn('text-[10px] font-bold', good ? 'text-green-600' : 'text-red-500')}>
      {good ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// ─── Entry form ───────────────────────────────────────────────────────────────

function EntryForm({ canEdit, onSaved }: { canEdit: boolean; onSaved: () => void }) {
  const today = new Date()
  const [week,     setWeek]     = useState(isoMonday(today))
  const [locale,   setLocale]   = useState(LOCALES[0])
  const [workflow, setWorkflow] = useState(WORKFLOWS[0])
  const [unit,     setUnit]     = useState<Unit>('min audio')
  const [amount,   setAmount]   = useState('')
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)

  function pickWeek(raw: string) {
    const d = new Date(raw + 'T12:00:00')
    if (!isNaN(d.getTime())) setWeek(isoMonday(d))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setError(null)
    setSuccess(false)
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) { setError('Amount must be a positive number.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/actuals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ week_start: week, locale, workflow, unit, amount: num, notes: notes || undefined }),
      })
      setSaving(false)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? `Save failed (HTTP ${res.status})`)
        return
      }
      setSuccess(true)
      setAmount('')
      setNotes('')
      onSaved()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Network error — could not reach the server.')
    }
  }

  if (!canEdit) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        Only admins and leads can enter actual production numbers.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
        <PlusCircle className="w-3.5 h-3.5" />
        Enter actual production
      </h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Week</label>
          <input
            type="date"
            value={week}
            onChange={e => pickWeek(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-[10px] text-slate-400 mt-0.5">Snaps to Monday</p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Locale</label>
          <select
            value={locale}
            onChange={e => setLocale(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {LOCALES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Workflow</label>
          <select
            value={workflow}
            onChange={e => setWorkflow(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {WORKFLOWS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Unit</label>
          <select
            value={unit}
            onChange={e => setUnit(e.target.value as Unit)}
            className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Amount <span className="text-slate-400">({UNIT_LABEL[unit]})</span>
          </label>
          <input
            type="number"
            min={0}
            step="any"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="e.g. 1250"
            className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. includes catch-up"
            className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {error   && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}
      {success && <p className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" />Saved.</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || !amount}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 transition-colors"
        >
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : 'Save actual'}
        </button>
      </div>
    </form>
  )
}

// ─── CompareTable (summary + per-locale breakdown) ────────────────────────────

interface SnapWeek {
  id:         string
  week_start: string
  min_audio:  number
  rep:        number
  wu:         number
}

interface CompareProps {
  actuals:        Actual[]
  weekStart:      string
  snapshotList:   SnapWeek[] | null
  snapshotDetail: Snapshot   | null
  loadingDetail:  boolean
}

function CompareTable({ actuals, weekStart: ws, snapshotList, snapshotDetail, loadingDetail }: CompareProps) {
  const snap = snapshotList?.find(s => s.week_start === ws) ?? null

  const weekActuals = actuals.filter(a => a.week_start === ws)

  // ── Aggregate totals by unit ──────────────────────────────────────────────
  const actualTotals: Record<string, number> = { 'min audio': 0, rep: 0, WU: 0 }
  for (const a of weekActuals) {
    actualTotals[a.unit] = (actualTotals[a.unit] ?? 0) + a.amount
  }

  const projTotals = snap
    ? { 'min audio': snap.min_audio, rep: snap.rep, WU: snap.wu }
    : null

  // ── Per-locale breakdown ──────────────────────────────────────────────────
  // Actuals grouped by locale + unit
  const actualByLocale = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const a of weekActuals) {
      if (!map[a.locale]) map[a.locale] = { 'min audio': 0, rep: 0, WU: 0 }
      map[a.locale][a.unit] = (map[a.locale][a.unit] ?? 0) + a.amount
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, actuals])

  // Projected grouped by locale (from snapshot detail rows)
  const projByLocale = useMemo(() => {
    if (!snapshotDetail) return null
    const map: Record<string, { min_audio: number; rep: number; wu: number }> = {}
    for (const row of snapshotDetail.rows) {
      if (!map[row.locale]) map[row.locale] = { min_audio: 0, rep: 0, wu: 0 }
      map[row.locale].min_audio += row.min_audio
      map[row.locale].rep       += row.rep
      map[row.locale].wu        += row.wu
    }
    return map
  }, [snapshotDetail])

  const allLocales = useMemo(() => {
    const s = new Set([
      ...Object.keys(actualByLocale),
      ...(projByLocale ? Object.keys(projByLocale) : []),
    ])
    return Array.from(s).sort()
  }, [actualByLocale, projByLocale])

  const units: Unit[] = ['min audio', 'rep', 'WU']

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">
          {fmtWeek(ws)} — Projected vs Actual
        </span>
        {snap === null && snapshotList !== null && (
          <span className="text-[11px] text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />No snapshot for this week
          </span>
        )}
      </div>

      {/* ── Total summary ── */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="text-left  px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-32">Unit</th>
            <th className="text-right px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Projected</th>
            <th className="text-right px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Actual</th>
            <th className="text-right px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Δ vs proj.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {units.map(u => {
            const actual = actualTotals[u] ?? 0
            const proj   = projTotals?.[u] ?? 0
            if (actual === 0 && proj === 0) return null
            return (
              <tr key={u} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-xs font-medium text-slate-600">{UNIT_LABEL[u]}</td>
                <td className="px-4 py-3 text-right">
                  {proj > 0
                    ? <><span className="text-xs font-semibold text-slate-700">{proj.toLocaleString()}</span><span className="text-[10px] text-slate-400 ml-1">{u}</span></>
                    : <span className="text-[11px] text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {actual > 0
                    ? <><span className="text-xs font-semibold text-slate-800">{actual.toLocaleString()}</span><span className="text-[10px] text-slate-400 ml-1">{u}</span></>
                    : <span className="text-[11px] text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  <DeltaBadge actual={actual} proj={proj} />
                  {(!proj || !actual) && <span className="text-[11px] text-slate-300">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── Per-locale breakdown ── */}
      {(allLocales.length > 0 || loadingDetail) && (
        <div className="border-t border-slate-100">
          <div className="px-5 py-2.5 bg-slate-50/50 flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">By locale</p>
            {loadingDetail && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
            {!projByLocale && !loadingDetail && snap && (
              <span className="text-[10px] text-amber-600">projected data not available</span>
            )}
          </div>

          {allLocales.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  <th className="text-left  px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-24">Locale</th>
                  <th className="text-right px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Proj. audio</th>
                  <th className="text-right px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Act. audio</th>
                  <th className="text-right px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Proj. rep</th>
                  <th className="text-right px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Act. rep</th>
                  <th className="text-right px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Proj. WU</th>
                  <th className="text-right px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Act. WU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allLocales.map(locale => {
                  const pa = actualByLocale[locale]  ?? {}
                  const pp = projByLocale?.[locale]   ?? null

                  const aAudio = pa['min audio'] ?? 0
                  const aRep   = pa['rep']        ?? 0
                  const aWU    = pa['WU']          ?? 0
                  const pAudio = pp?.min_audio     ?? 0
                  const pRep   = pp?.rep            ?? 0
                  const pWU    = pp?.wu             ?? 0

                  return (
                    <tr key={locale} className="hover:bg-slate-50">
                      <td className="px-5 py-2 font-mono font-semibold text-slate-700">{locale}</td>
                      {/* Audio */}
                      <td className="px-4 py-2 text-right text-slate-500">{fmtNum(pAudio)}</td>
                      <td className="px-4 py-2 text-right">
                        <span className="font-semibold text-slate-800">{fmtNum(aAudio)}</span>
                        {aAudio > 0 && pAudio > 0 && (
                          <span className="ml-1.5"><DeltaBadge actual={aAudio} proj={pAudio} /></span>
                        )}
                      </td>
                      {/* Rep */}
                      <td className="px-4 py-2 text-right text-slate-500">{fmtNum(pRep)}</td>
                      <td className="px-4 py-2 text-right">
                        <span className="font-semibold text-slate-800">{fmtNum(aRep)}</span>
                        {aRep > 0 && pRep > 0 && (
                          <span className="ml-1.5"><DeltaBadge actual={aRep} proj={pRep} /></span>
                        )}
                      </td>
                      {/* WU */}
                      <td className="px-5 py-2 text-right text-slate-500">{fmtNum(pWU)}</td>
                      <td className="px-5 py-2 text-right">
                        <span className="font-semibold text-slate-800">{fmtNum(aWU)}</span>
                        {aWU > 0 && pWU > 0 && (
                          <span className="ml-1.5"><DeltaBadge actual={aWU} proj={pWU} /></span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Raw actuals log ── */}
      {weekActuals.length > 0 && (
        <div className="border-t border-slate-100">
          <div className="px-5 py-2 bg-slate-50/50">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Actuals entered</p>
          </div>
          <div className="divide-y divide-slate-50">
            {weekActuals.map(a => (
              <div key={a.id} className="flex items-center gap-4 px-5 py-2 text-xs">
                <span className="font-mono text-slate-500 w-16 shrink-0">{a.locale}</span>
                <span className="text-slate-500 w-20 shrink-0">{a.workflow}</span>
                <span className="font-semibold text-slate-700">{a.amount.toLocaleString()}</span>
                <span className="text-slate-400">{UNIT_LABEL[a.unit as Unit]}</span>
                {a.notes && <span className="text-slate-400 italic truncate">{a.notes}</span>}
                <span className="ml-auto text-[10px] text-slate-300 shrink-0">
                  {format(new Date(a.entered_at), 'dd MMM HH:mm')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {weekActuals.length === 0 && (
        <p className="px-5 py-4 text-xs text-slate-400 border-t border-slate-100">
          No actuals entered for this week yet.
        </p>
      )}
    </div>
  )
}

// ─── Monthly actual summary ───────────────────────────────────────────────────

interface MonthlyRow {
  sortKey:   string
  month:     string
  projAudio: number
  projRep:   number
  projWU:    number
  actAudio:  number
  actRep:    number
  actWU:     number
}

function MonthlyActualSummary({
  actuals,
  snapshots,
}: {
  actuals:   Actual[]
  snapshots: SnapWeek[] | null
}) {
  const rows = useMemo((): MonthlyRow[] => {
    const map: Record<string, MonthlyRow> = {}

    // Bucket actuals by month
    for (const a of actuals) {
      const d      = new Date(a.week_start + 'T12:00:00')
      const sortKey = format(d, 'yyyy-MM')
      const label   = format(d, 'MMM yyyy')
      if (!map[sortKey]) {
        map[sortKey] = { sortKey, month: label, projAudio: 0, projRep: 0, projWU: 0, actAudio: 0, actRep: 0, actWU: 0 }
      }
      if (a.unit === 'min audio') map[sortKey].actAudio += a.amount
      if (a.unit === 'rep')       map[sortKey].actRep   += a.amount
      if (a.unit === 'WU')        map[sortKey].actWU    += a.amount
    }

    // Bucket projected totals by month (from snapshot summaries)
    for (const s of (snapshots ?? [])) {
      const d      = new Date(s.week_start + 'T12:00:00')
      const sortKey = format(d, 'yyyy-MM')
      const label   = format(d, 'MMM yyyy')
      if (!map[sortKey]) {
        map[sortKey] = { sortKey, month: label, projAudio: 0, projRep: 0, projWU: 0, actAudio: 0, actRep: 0, actWU: 0 }
      }
      map[sortKey].projAudio += s.min_audio
      map[sortKey].projRep   += s.rep
      map[sortKey].projWU    += s.wu
    }

    return Object.values(map).sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  }, [actuals, snapshots])

  if (rows.length === 0) return null

  // Only show months that have at least some data on both sides
  const meaningfulRows = rows.filter(r => r.actAudio + r.actRep + r.actWU > 0)
  if (meaningfulRows.length === 0) return null

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-brand-500" />
        <span className="text-sm font-semibold text-slate-700">Monthly summary — projected vs actual</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="text-left  px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-28">Month</th>
            <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Proj. audio</th>
            <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Act. audio</th>
            <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Δ audio</th>
            <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Proj. rep</th>
            <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Act. rep</th>
            <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Δ rep</th>
            <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Proj. WU</th>
            <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Act. WU</th>
            <th className="text-right px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Δ WU</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {meaningfulRows.map(r => (
            <tr key={r.sortKey} className="hover:bg-slate-50">
              <td className="px-5 py-2.5 text-xs font-semibold text-slate-700">{r.month}</td>
              <td className="px-3 py-2.5 text-right text-xs text-slate-500">{fmtNum(r.projAudio)}</td>
              <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">{fmtNum(r.actAudio)}</td>
              <td className="px-3 py-2.5 text-right"><DeltaBadge actual={r.actAudio} proj={r.projAudio} /></td>
              <td className="px-3 py-2.5 text-right text-xs text-slate-500">{fmtNum(r.projRep)}</td>
              <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">{fmtNum(r.actRep)}</td>
              <td className="px-3 py-2.5 text-right"><DeltaBadge actual={r.actRep} proj={r.projRep} /></td>
              <td className="px-3 py-2.5 text-right text-xs text-slate-500">{fmtNum(r.projWU)}</td>
              <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">{fmtNum(r.actWU)}</td>
              <td className="px-5 py-2.5 text-right"><DeltaBadge actual={r.actWU} proj={r.projWU} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-5 py-2 text-[10px] text-slate-400 border-t border-slate-100">
        Monthly projected = sum of weekly snapshot projections for that month.
        Only months with at least one actual entered are shown.
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectionActuals({ canEdit }: { canEdit: boolean }) {
  const today = new Date()
  const [week,           setWeek]           = useState(isoMonday(today))
  const [actuals,        setActuals]        = useState<Actual[]>([])
  const [snapshots,      setSnapshots]      = useState<SnapWeek[] | null>(null)
  const [snapshotDetail, setSnapshotDetail] = useState<Snapshot | null>(null)
  const [loadingDetail,  setLoadingDetail]  = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)

  const loadActuals = useCallback(() => {
    setLoading(true)
    fetch('/api/actuals')
      .then(r => r.json())
      .then(d => { setActuals(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Network error'); setLoading(false) })
  }, [])

  // Load snapshot summaries once
  useEffect(() => {
    fetch('/api/projections/snapshots')
      .then(r => r.json())
      .then(d => setSnapshots(Array.isArray(d) ? d : []))
      .catch(() => setSnapshots([]))
  }, [])

  useEffect(() => { loadActuals() }, [loadActuals])

  // Load snapshot detail (per-locale rows) when selected week changes
  useEffect(() => {
    if (!snapshots) return
    const snap = snapshots.find(s => s.week_start === week)
    if (!snap) { setSnapshotDetail(null); return }
    setLoadingDetail(true)
    fetch(`/api/projections/snapshots/${snap.id}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { setSnapshotDetail(d as Snapshot); setLoadingDetail(false) })
      .catch(() => { setSnapshotDetail(null); setLoadingDetail(false) })
  }, [week, snapshots])

  // Distinct weeks from actuals + current week, newest first
  const weeks = Array.from(
    new Set([isoMonday(today), ...actuals.map(a => a.week_start)]),
  ).sort().reverse()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-brand-500" />
        <h2 className="text-sm font-bold text-slate-800">Projected vs Actuals</h2>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Entry form */}
      <EntryForm canEdit={canEdit} onSaved={loadActuals} />

      {/* Week selector + comparison */}
      {loading && !actuals.length ? (
        <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Loading actuals…</span>
        </div>
      ) : (
        <>
          {/* Week pill buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {weeks.slice(0, 8).map(w => (
              <button
                key={w}
                onClick={() => setWeek(w)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-full border transition-colors',
                  week === w
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-brand-400',
                )}
              >
                {fmtWeek(w)}
              </button>
            ))}
          </div>

          <CompareTable
            actuals={actuals}
            weekStart={week}
            snapshotList={snapshots}
            snapshotDetail={snapshotDetail}
            loadingDetail={loadingDetail}
          />
        </>
      )}

      {/* Monthly summary (shown once we have enough data) */}
      {actuals.length > 0 && (
        <MonthlyActualSummary actuals={actuals} snapshots={snapshots ?? []} />
      )}
    </div>
  )
}

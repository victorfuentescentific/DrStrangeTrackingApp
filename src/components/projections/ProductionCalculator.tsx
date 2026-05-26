'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Calculator, ChevronDown, Shield, Zap, Save, Clock, RotateCcw, ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowType } from '@/lib/types'
import { get1PRate } from '@/lib/eta-calculator'

// 2Pass team size by locale — practical override (different from ETA model which always uses 4)
const P2_HC: Record<string, number> = {
  en_GB: 3,
  de_DE: 4,
  fr_FR: 4,
  nl_NL: 4,
}
const DEFAULT_P2_HC = 4
const BUFFER = 0.80  // 20% reduction

const LOCALES = ['en_GB', 'de_DE', 'nl_NL', 'fr_FR', 'da_DK', 'nb_NO', 'fi_FI', 'sv_SE', 'other']
const WORKFLOWS: WorkflowType[] = ['DAX', 'DMO', 'Scribing']
const HOURS_PER_DAY = 8

// get1PRate imported from eta-calculator — single source of truth for 1P rates.
// getDailyRate = get1PRate; getHourlyRate = get1PRate / HOURS_PER_DAY.

function getUnit(workflow: WorkflowType): string {
  return workflow === 'Scribing' ? 'rep' : 'min audio'
}

// Convert decimal minutes to "Xh Ymin" string
function minsToHourMin(mins: number): string {
  if (mins <= 0) return '0h 0min'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function NumInput({
  label, value, onChange, min = 0, helper,
}: {
  label: string; value: number; onChange: (v: number) => void; min?: number; helper?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type="number"
        min={min}
        value={value || ''}
        onChange={e => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-slate-800"
      />
      {helper && <p className="text-[10px] text-slate-400 mt-0.5">{helper}</p>}
    </div>
  )
}

function BreakdownRow({ label, hc, days, hours, accent }: {
  label: string; hc: number; days: number; hours: number; accent: string
}) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  const timeStr = m > 0 ? `${h}h ${m}min` : `${h}h`
  return (
    <div className={cn('flex items-center justify-between px-4 py-3 rounded-lg', accent)}>
      <div>
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        <p className="text-[10px] text-slate-500">{hc} people × {HOURS_PER_DAY}h × {days} day{days !== 1 ? 's' : ''}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-slate-800">{hours.toLocaleString()} h</p>
        {hours > 0 && <p className="text-[10px] text-slate-400">{timeStr}</p>}
      </div>
    </div>
  )
}

interface OutputCardProps {
  title: string
  icon: React.ReactNode
  output: number
  unit: string
  perPerson: number
  rateLabel: string
  shortage: boolean
  variant: 'full' | 'buffer'
}

function OutputCard({ title, icon, output, unit, perPerson, rateLabel, shortage, variant }: OutputCardProps) {
  const isMin = unit === 'min audio'
  const roundedOutput = Math.round(output)
  const roundedPP     = Math.round(perPerson)

  const containerCls = cn(
    'relative rounded-xl border overflow-hidden flex-1',
    shortage
      ? 'bg-red-50 border-red-200'
      : variant === 'full'
        ? 'bg-gradient-to-br from-brand-50 to-indigo-50 border-brand-200'
        : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200',
  )

  const valueCls = cn(
    'text-4xl font-extrabold tracking-tight',
    shortage ? 'text-red-600' : variant === 'full' ? 'text-brand-600' : 'text-amber-600',
  )

  const badgeCls = cn(
    'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-3',
    shortage
      ? 'bg-red-100 text-red-600'
      : variant === 'full'
        ? 'bg-brand-100 text-brand-700'
        : 'bg-amber-100 text-amber-700',
  )

  return (
    <div className={containerCls}>
      {/* Accent bar */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-1',
        shortage ? 'bg-red-400' : variant === 'full' ? 'bg-brand-500' : 'bg-amber-400',
      )} />

      <div className="p-5 pt-6 text-center">
        <span className={badgeCls}>
          {icon}
          {title}
        </span>

        <div className={cn('text-[10px] font-semibold uppercase tracking-widest mb-1',
          shortage ? 'text-red-400' : variant === 'full' ? 'text-brand-400' : 'text-amber-500')}>
          1P projected output
        </div>

        {/* Main number */}
        <p className={valueCls}>
          {shortage ? '0' : roundedOutput.toLocaleString()}
        </p>
        <p className={cn('text-sm font-medium mb-2', shortage ? 'text-red-400' : 'text-slate-500')}>
          {unit}
        </p>

        {/* h:mm conversion for min audio */}
        {isMin && !shortage && roundedOutput > 0 && (
          <div className={cn(
            'inline-block px-3 py-1 rounded-lg text-sm font-bold mb-3',
            variant === 'full' ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700',
          )}>
            = {minsToHourMin(roundedOutput)}
          </div>
        )}

        {/* Per-person breakdown */}
        {!shortage && roundedOutput > 0 && (
          <div className="mt-1 pt-3 border-t border-white/60 space-y-0.5">
            <p className="text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">{roundedPP.toLocaleString()}</span>
              {' '}{unit}/person
              {isMin && <span className="text-slate-400"> ({minsToHourMin(roundedPP)})</span>}
            </p>
            <p className="text-[10px] text-slate-400">{rateLabel}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Calculator session type (mirrors API / DB row) ──────────────────────────

interface CalcSession {
  id: string
  locale: string
  workflow: string
  hc: number
  total_hours: number
  iaa_days: number
  p2_days: number
  phi_days: number
  output_full: number
  output_buf: number
  unit: string
  label: string | null
  created_at: string
}

// ─── History panel ────────────────────────────────────────────────────────────

function HistoryPanel({
  sessions,
  onLoad,
  onRefresh,
  loading,
}: {
  sessions: CalcSession[]
  onLoad: (s: CalcSession) => void
  onRefresh: () => void
  loading: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-100"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">
            Past calculations
            {sessions.length > 0 && (
              <span className="ml-1.5 text-xs font-medium text-slate-400">({sessions.length})</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onRefresh() }}
            disabled={loading}
            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            title="Refresh"
          >
            <RotateCcw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div>
          {loading && sessions.length === 0 && (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          )}
          {!loading && sessions.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-8">
              No saved calculations yet. Save a result below.
            </p>
          )}
          {sessions.length > 0 && (
            <div className="divide-y divide-slate-50">
              {sessions.map(s => {
                const d = new Date(s.created_at)
                const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 group">
                    <div className="flex-1 min-w-0">
                      {s.label && (
                        <p className="text-xs font-semibold text-slate-700 truncate">{s.label}</p>
                      )}
                      <p className="text-[11px] text-slate-500">
                        <span className="font-mono font-medium text-slate-600">{s.locale}</span>
                        {' · '}{s.workflow}
                        {' · '}{s.hc} HC
                        {' · '}{s.total_hours}h
                      </p>
                      <p className="text-[10px] text-slate-400">{dateStr} {timeStr}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-brand-600">{Math.round(s.output_full).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">{s.unit}</p>
                    </div>
                    <button
                      onClick={() => onLoad(s)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-brand-600 hover:text-brand-800 px-2 py-1 rounded bg-brand-50 hover:bg-brand-100 shrink-0"
                      title="Load these inputs into the calculator"
                    >
                      Load
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main calculator ──────────────────────────────────────────────────────────

export function ProductionCalculator() {
  const [locale, setLocale]         = useState('nl_NL')
  const [workflow, setWorkflow]     = useState<WorkflowType>('DAX')
  const [hc, setHc]                 = useState(11)
  const [totalHours, setTotalHours] = useState(440)
  const [iaaDays, setIaaDays]       = useState(0)
  const [p2Days, setP2Days]         = useState(0)
  const [phiDays, setPhiDays]       = useState(0)

  // ── Session history state ────────────────────────────────────────────────
  const [sessions,     setSessions]     = useState<CalcSession[]>([])
  const [sessLoading,  setSessLoading]  = useState(true)
  const [label,        setLabel]        = useState('')
  const [isSaving,     setIsSaving]     = useState(false)
  const [saveMsg,      setSaveMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  const loadSessions = useCallback(() => {
    setSessLoading(true)
    fetch('/api/calculator-sessions')
      .then(r => r.json())
      .then(d => { setSessions(Array.isArray(d) ? d : []); setSessLoading(false) })
      .catch(() => setSessLoading(false))
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  function loadSession(s: CalcSession) {
    setLocale(s.locale)
    setWorkflow(s.workflow as WorkflowType)
    setHc(s.hc)
    setTotalHours(s.total_hours)
    setIaaDays(s.iaa_days)
    setP2Days(s.p2_days)
    setPhiDays(s.phi_days)
    setSaveMsg(null)
  }

  const p2Hc = P2_HC[locale] ?? DEFAULT_P2_HC

  const calc = useMemo(() => {
    const iaaHours  = hc   * HOURS_PER_DAY * iaaDays
    const p2Hours   = p2Hc * HOURS_PER_DAY * p2Days
    const phiHours  = hc   * HOURS_PER_DAY * phiDays
    const consumed  = iaaHours + p2Hours + phiHours
    const remaining = Math.max(0, totalHours - consumed)
    const rate      = get1PRate(workflow, locale) / HOURS_PER_DAY
    const output    = remaining * rate
    const perPerson = hc > 0 ? output / hc : 0
    return { iaaHours, p2Hours, phiHours, consumed, remaining, output, perPerson }
  }, [locale, workflow, hc, totalHours, iaaDays, p2Days, phiDays, p2Hc])

  const unit      = getUnit(workflow)
  const shortage  = calc.consumed > totalHours
  const daily     = get1PRate(workflow, locale)
  const rateLabel = `Rate: ${daily} ${unit}/p/day · 2Pass team: ${p2Hc} (${locale})`

  async function handleSave() {
    if (calc.output <= 0 || shortage) return
    setIsSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/calculator-sessions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          workflow,
          hc,
          total_hours: totalHours,
          iaa_days:    iaaDays,
          p2_days:     p2Days,
          phi_days:    phiDays,
          output_full: Math.round(calc.output),
          output_buf:  Math.round(calc.output * BUFFER),
          unit,
          label: label.trim() || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        setSaveMsg({ ok: false, text: d.error ?? 'Save failed' })
      } else {
        setSaveMsg({ ok: true, text: 'Saved!' })
        setLabel('')
        loadSessions()
        setTimeout(() => setSaveMsg(null), 3000)
      }
    } catch (err) {
      setSaveMsg({ ok: false, text: `Network error: ${(err as Error).message}` })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Inputs ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-brand-500" />
          <span className="text-sm font-semibold text-slate-700">Inputs</span>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Locale */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Locale</label>
              <div className="relative">
                <select
                  value={locale}
                  onChange={e => setLocale(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-brand-400 text-slate-800 bg-white pr-8"
                >
                  {LOCALES.map(l => (
                    <option key={l} value={l}>{l === 'other' ? 'Other / unknown' : l}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Workflow toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Workflow</label>
              <div className="flex rounded-lg overflow-hidden border border-slate-200">
                {WORKFLOWS.map(wf => (
                  <button
                    key={wf}
                    onClick={() => setWorkflow(wf)}
                    className={cn(
                      'flex-1 text-xs py-2 font-semibold transition-colors',
                      workflow === wf ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50',
                    )}
                  >
                    {wf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NumInput
              label="Nº HC (headcount)"
              value={hc}
              onChange={setHc}
              min={1}
              helper="Total people working on this workset"
            />
            <NumInput
              label="Working Hours (team total)"
              value={totalHours}
              onChange={setTotalHours}
              min={1}
              helper={`e.g. ${hc} people × 40h/week = ${hc * 40} h`}
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Days invested per phase
            </p>
            <div className="grid grid-cols-3 gap-4">
              <NumInput
                label="IAA days"
                value={iaaDays}
                onChange={setIaaDays}
                helper={`All ${hc} HC → ${hc * HOURS_PER_DAY} h/day`}
              />
              <NumInput
                label="2Pass days"
                value={p2Days}
                onChange={setP2Days}
                helper={`${p2Hc} people (${locale}) → ${p2Hc * HOURS_PER_DAY} h/day`}
              />
              <NumInput
                label="PHI days"
                value={phiDays}
                onChange={setPhiDays}
                helper={`All ${hc} HC → ${hc * HOURS_PER_DAY} h/day`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Hours breakdown ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <span className="text-sm font-semibold text-slate-700">Hours breakdown</span>
        </div>
        <div className="p-5 space-y-2">
          <BreakdownRow label="IAA"   hc={hc}    days={iaaDays} hours={calc.iaaHours} accent="bg-blue-50" />
          <BreakdownRow label="2Pass" hc={p2Hc}  days={p2Days}  hours={calc.p2Hours}  accent="bg-orange-50" />
          <BreakdownRow label="PHI"   hc={hc}    days={phiDays} hours={calc.phiHours} accent="bg-green-50" />

          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Total hours consumed (IAA + 2Pass + PHI)</span>
              <span className={cn('font-semibold', shortage ? 'text-red-600' : 'text-slate-700')}>
                {calc.consumed.toLocaleString()} h
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Working hours available</span>
              <span className="font-semibold text-slate-700">{totalHours.toLocaleString()} h</span>
            </div>
            <div className={cn(
              'flex justify-between text-sm font-bold px-3 py-2 rounded-lg',
              shortage ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-800',
            )}>
              <span>Remaining for 1P production</span>
              <div className="text-right">
                <span>{calc.remaining.toLocaleString()} h</span>
                {calc.remaining > 0 && (
                  <span className="text-xs font-normal text-slate-400 ml-2">
                    ({Math.floor(calc.remaining)}h {Math.round((calc.remaining % 1) * 60)}min)
                  </span>
                )}
              </div>
            </div>
            {shortage && (
              <p className="text-[11px] text-red-500 text-right">
                Over-allocated by {(calc.consumed - totalHours).toLocaleString()} h
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Dual output cards ───────────────────────────────────────────────── */}
      <div className="flex gap-4">
        <OutputCard
          title="Full estimate"
          icon={<Zap className="w-2.5 h-2.5" />}
          output={calc.output}
          unit={unit}
          perPerson={calc.perPerson}
          rateLabel={rateLabel}
          shortage={shortage}
          variant="full"
        />

        {/* Divider with label */}
        <div className="flex flex-col items-center justify-center gap-1 shrink-0">
          <div className="w-px flex-1 bg-slate-200" />
          <div className="text-[10px] font-bold text-slate-400 bg-white px-1 text-center leading-tight">
            −20%<br/>buffer
          </div>
          <div className="w-px flex-1 bg-slate-200" />
        </div>

        <OutputCard
          title="Buffered (−20%)"
          icon={<Shield className="w-2.5 h-2.5" />}
          output={calc.output * BUFFER}
          unit={unit}
          perPerson={calc.perPerson * BUFFER}
          rateLabel={rateLabel}
          shortage={shortage}
          variant="buffer"
        />
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        Buffer applies a 20% safety margin to account for interruptions, absences, and quality rework.
      </p>

      {/* ── Save result ─────────────────────────────────────────────────────── */}
      {!shortage && calc.output > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5 text-brand-500" />
            Save this result
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              placeholder="Optional label (e.g. "Week 23 DAX NL")"
              maxLength={120}
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-slate-800"
            />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition-colors"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </button>
          </div>
          {saveMsg && (
            <p className={cn(
              'mt-2 text-[11px] font-medium',
              saveMsg.ok ? 'text-green-600' : 'text-red-600',
            )}>
              {saveMsg.text}
            </p>
          )}
        </div>
      )}

      {/* ── History panel ───────────────────────────────────────────────────── */}
      <HistoryPanel
        sessions={sessions}
        onLoad={loadSession}
        onRefresh={loadSessions}
        loading={sessLoading}
      />
    </div>
  )
}

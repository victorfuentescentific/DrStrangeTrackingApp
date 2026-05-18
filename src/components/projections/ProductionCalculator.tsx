'use client'

import { useState, useMemo } from 'react'
import { Calculator, ChevronDown, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowType } from '@/lib/types'

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

function getHourlyRate(workflow: WorkflowType, locale: string): number {
  if (workflow === 'DAX') return 27 / HOURS_PER_DAY
  if (workflow === 'DMO') return 25 / HOURS_PER_DAY
  return (locale === 'fr_FR' ? 4 : 6) / HOURS_PER_DAY
}

function getDailyRate(workflow: WorkflowType, locale: string): number {
  if (workflow === 'DAX') return 27
  if (workflow === 'DMO') return 25
  return locale === 'fr_FR' ? 4 : 6
}

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

export function ProductionCalculator() {
  const [locale, setLocale]         = useState('nl_NL')
  const [workflow, setWorkflow]     = useState<WorkflowType>('DAX')
  const [hc, setHc]                 = useState(11)
  const [totalHours, setTotalHours] = useState(440)
  const [iaaDays, setIaaDays]       = useState(0)
  const [p2Days, setP2Days]         = useState(0)
  const [phiDays, setPhiDays]       = useState(0)

  const p2Hc = P2_HC[locale] ?? DEFAULT_P2_HC

  const calc = useMemo(() => {
    const iaaHours  = hc   * HOURS_PER_DAY * iaaDays
    const p2Hours   = p2Hc * HOURS_PER_DAY * p2Days
    const phiHours  = hc   * HOURS_PER_DAY * phiDays
    const consumed  = iaaHours + p2Hours + phiHours
    const remaining = Math.max(0, totalHours - consumed)
    const rate      = getHourlyRate(workflow, locale)
    const output    = remaining * rate
    const perPerson = hc > 0 ? output / hc : 0
    return { iaaHours, p2Hours, phiHours, consumed, remaining, output, perPerson }
  }, [locale, workflow, hc, totalHours, iaaDays, p2Days, phiDays, p2Hc])

  const unit     = getUnit(workflow)
  const shortage = calc.consumed > totalHours
  const daily    = getDailyRate(workflow, locale)
  const rateLabel = `Rate: ${daily} ${unit}/p/day · 2Pass team: ${p2Hc} (${locale})`

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
    </div>
  )
}

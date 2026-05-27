'use client'

import { useState, useEffect } from 'react'
import { Workset, WorkflowType, TeamType, Region, Priority, RiskLevel, WorksetStatus } from '@/lib/types'
import { MOCK_USERS } from '@/lib/mock-data'
import { LOCALES_BY_REGION } from '@/lib/mock-data'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/lib/store'
import { calculateETA, calculateSuccessorETA, addWorkingDays, getSuccessorStartDate, getDefaultTeamSize, TIER2_LOCALES, WORKFLOW_BG } from '@/lib/eta-calculator'
import { formatDate, cn, getEffectiveRisk, expiryCountdownLabel, RISK_COLORS, RISK_LABELS } from '@/lib/utils'
import { AlertTriangle, Zap, Info, Link2, CalendarClock } from 'lucide-react'

type FormData = {
  name: string
  workflow: WorkflowType
  locale: string
  team: TeamType
  region: Region
  teamSize: string
  startDate: string
  eta: string
  revisedEta: string
  expirationDate: string
  status: WorksetStatus
  priority: Priority
  riskLevel: RiskLevel
  isBlocked: boolean
  blockerDescription: string
  isEscalated: boolean
  escalationReason: string
  notes: string
  predecessorId: string
}

interface WorksetFormProps {
  initial?: Workset
  onSubmit: (data: FormData) => void
  onCancel: () => void
  isEdit?: boolean
}

const today = new Date().toISOString().split('T')[0]

const DEFAULT: FormData = {
  name: '', workflow: 'DAX', locale: '', team: 'Transcription', region: 'EU',
  teamSize: '11', startDate: today, eta: '', revisedEta: '', expirationDate: '',
  status: 'not-started', priority: 'medium', riskLevel: 'low',
  isBlocked: false, blockerDescription: '',
  isEscalated: false, escalationReason: '', notes: '',
  predecessorId: '',
}

function getTeamForWorkflow(w: WorkflowType): TeamType {
  return w === 'Scribing' ? 'Scribing' : 'Transcription'
}

export function WorksetForm({ initial, onSubmit, onCancel, isEdit }: WorksetFormProps) {
  const { currentUser, worksets } = useStore()
  const [form, setForm] = useState<FormData>(
    initial ? {
      name: initial.name,
      workflow: initial.workflow,
      locale: initial.locale,
      team: initial.team,
      region: initial.region,
      teamSize: String(initial.teamSize),
      startDate: initial.startDate,
      eta: initial.eta,
      revisedEta: initial.revisedEta ?? '',
      expirationDate: initial.expirationDate ?? '',
      status: initial.status,
      priority: initial.priority,
      riskLevel: initial.riskLevel,
      isBlocked: initial.isBlocked,
      blockerDescription: initial.blockerDescription ?? '',
      isEscalated: initial.isEscalated,
      escalationReason: initial.escalationReason ?? '',
      notes: initial.notes,
      predecessorId: initial.predecessorId ?? '',
    } : DEFAULT,
  )

  // UI-only: whether this workset is a sequential (back-to-back) successor
  const [isBackToBack, setIsBackToBack] = useState(!!(initial?.predecessorId))

  const [etaSuggestion, setEtaSuggestion] = useState<ReturnType<typeof calculateETA> | null>(null)

  // Worksets eligible as a predecessor: has phases, not completed, same workflow if already chosen
  const predecessorOptions = worksets.filter(w =>
    w.phases &&
    w.status !== 'completed' &&
    (!form.workflow || w.workflow === form.workflow),
  )

  const set = (field: keyof FormData, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  // Auto-set team when workflow changes
  useEffect(() => {
    set('team', getTeamForWorkflow(form.workflow))
  }, [form.workflow])

  // Auto-fill team size when locale changes
  useEffect(() => {
    if (form.locale) {
      const size = getDefaultTeamSize(form.locale, form.workflow)
      set('teamSize', String(size))
    }
  }, [form.locale, form.workflow])

  // When predecessor is picked in sequential mode, mirror its workflow / locale / region
  useEffect(() => {
    if (!isBackToBack || !form.predecessorId) return
    const pred = worksets.find(w => w.id === form.predecessorId)
    if (!pred) return
    setForm(prev => ({
      ...prev,
      workflow: pred.workflow,
      locale:   pred.locale,
      region:   pred.region,
      team:     pred.team,
      teamSize: String(pred.teamSize),
    }))
  }, [form.predecessorId, isBackToBack])

  // Recalculate ETA suggestion for back-to-back worksets.
  // form.startDate is intentionally excluded from deps — including it would cause the
  // effect to overwrite any manual start-date edit the user makes.
  // startDate is only auto-set on creation (!isEdit), never when editing an existing workset.
  useEffect(() => {
    if (!isBackToBack || !form.predecessorId) return
    const n = parseInt(form.teamSize)
    const pred = worksets.find(w => w.id === form.predecessorId)
    if (!pred?.phases || !form.locale || n < 5) return
    const result = calculateSuccessorETA(pred.phases, form.workflow, form.locale, n)
    setEtaSuggestion(result)
    set('eta', result.etaDate)
    // Auto-fill start date only when creating a new workset, not when editing
    if (!isEdit) {
      set('startDate', getSuccessorStartDate(pred.phases.etaDate))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.workflow, form.locale, form.teamSize, form.predecessorId, isBackToBack, isEdit])

  // Recalculate ETA suggestion for standalone worksets.
  // Separate effect so startDate changes trigger recalculation here without
  // interfering with the back-to-back branch above.
  useEffect(() => {
    if (isBackToBack) return
    const n = parseInt(form.teamSize)
    if (!form.locale || !form.startDate || n < 5) return
    const result = calculateETA(form.workflow, form.locale, n, form.startDate)
    setEtaSuggestion(result)
    if (!form.eta || form.eta === '') {
      set('eta', result.etaDate)
    }
  }, [form.workflow, form.locale, form.teamSize, form.startDate, isBackToBack])

  const applyEtaSuggestion = () => {
    if (etaSuggestion) set('eta', etaSuggestion.etaDate)
  }

  const isTier2 = TIER2_LOCALES.includes(form.locale)
  const inputClass = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
  const labelClass = 'block text-xs font-semibold text-slate-600 mb-1'

  // Locale options filtered by region
  const localeGroups = LOCALES_BY_REGION[form.region] ?? {}

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="space-y-5">

      {/* Name */}
      <div>
        <label className={labelClass}>Workset Name *</label>
        <input
          required
          type="text"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. de_DE DAX Batch Round 5"
          className={inputClass}
        />
      </div>

      {/* Batch type — only shown when creating */}
      {!isEdit && (
        <div>
          <label className={labelClass}>Batch type</label>
          <div className="grid grid-cols-2 rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
            <button
              type="button"
              onClick={() => { setIsBackToBack(false); set('predecessorId', '') }}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 px-3 transition-colors',
                !isBackToBack
                  ? 'bg-brand-500 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              <span className="text-base leading-none">□</span>
              Standalone
            </button>
            <button
              type="button"
              onClick={() => setIsBackToBack(true)}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 px-3 border-l border-slate-200 transition-colors',
                isBackToBack
                  ? 'bg-brand-500 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              <Link2 className="w-3.5 h-3.5" />
              Sequential
            </button>
          </div>
          {isBackToBack && (
            <p className="text-[10px] text-brand-600 mt-1">
              Start date and phases are auto-derived from the Set 1 batch (head start model).
            </p>
          )}
        </div>
      )}

      {/* Predecessor picker (sequential mode only) */}
      {isBackToBack && !isEdit && (
        <div>
          <label className={labelClass}>Set 1 batch (predecessor) *</label>
          <select
            required={isBackToBack}
            value={form.predecessorId}
            onChange={e => set('predecessorId', e.target.value)}
            className={inputClass}
          >
            <option value="">Select Set 1…</option>
            {predecessorOptions.map(w => (
              <option key={w.id} value={w.id}>
                {w.worksetId} — {w.name} · {w.locale} · ETA {formatDate(w.eta)}
              </option>
            ))}
          </select>
          {form.predecessorId && (() => {
            const pred = worksets.find(w => w.id === form.predecessorId)
            if (!pred?.phases) return null
            const set2Start = getSuccessorStartDate(pred.phases.etaDate)
            return (
              <p className="text-[10px] text-slate-500 mt-1">
                Set 2 full team arrives <strong>{formatDate(set2Start)}</strong>
                {etaSuggestion?.headStart && (
                  <> · <strong>{(etaSuggestion.headStart.headStartPct * 100).toFixed(1)}%</strong> of 1P+IAA pre-completed during Set 1's 2P window</>
                )}
              </p>
            )
          })()}
        </div>
      )}

      {/* Workflow + Team (auto) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Workflow *</label>
          <select value={form.workflow} onChange={e => set('workflow', e.target.value as WorkflowType)} className={inputClass}>
            <option value="DAX">DAX — Transcribing</option>
            <option value="DMO">DMO — Transcription</option>
            <option value="Scribing">Scribing</option>
          </select>
          <div className="mt-1">
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', WORKFLOW_BG[form.workflow])}>
              {form.workflow}
            </span>
          </div>
        </div>
        <div>
          <label className={labelClass}>Team (auto)</label>
          <div className={cn(inputClass, 'bg-slate-50 text-slate-500 cursor-default flex items-center gap-2')}>
            <div className="w-2 h-2 rounded-full bg-brand-400" />
            {form.team}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Auto-set from workflow</p>
        </div>
      </div>

      {/* Region + Locale */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Region *</label>
          <select value={form.region} onChange={e => { set('region', e.target.value as Region); set('locale', '') }} className={inputClass}>
            <option value="EU">EU</option>
            <option value="US">US</option>
            <option value="IN">IN</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Locale *</label>
          <select
            required
            value={form.locale}
            onChange={e => set('locale', e.target.value)}
            className={inputClass}
          >
            <option value="">Select locale…</option>
            {Object.entries(localeGroups).map(([group, locales]) => (
              <optgroup key={group} label={group}>
                {(locales as { code: string; label: string; tier: number }[]).map(l => (
                  <option key={l.code} value={l.code}>
                    {l.code} — {l.label}{l.tier === 2 ? ' (Tier 2)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {isTier2 && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600">
              <AlertTriangle className="w-3 h-3" />
              Tier 2 (4hr/day) — ETA is an 8hr-model estimate
            </div>
          )}
          {form.locale === 'en_GB' && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-brand-600 bg-brand-50 border border-brand-200 rounded px-2 py-0.5">
              <Info className="w-3 h-3 flex-shrink-0" />
              en_GB exception — ETA uses NL-equivalent parameters (confirmed May 2026)
            </div>
          )}
        </div>
      </div>

      {/* Team Size */}
      <div>
        <label className={labelClass}>Team Size (N)</label>
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <input
              type="number" min="5" max="50"
              value={form.teamSize}
              onChange={e => set('teamSize', e.target.value)}
              className={inputClass}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Auto-filled for known EU Tier 1 locales. 2P sub-team = 4 (fixed, not included in N).
            </p>
          </div>
          {form.locale && (
            <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 whitespace-nowrap mt-0">
              <span className="font-semibold">N−4 = {Math.max(0, parseInt(form.teamSize || '0') - 4)}</span>
              <span className="text-slate-400"> PHI Ph.1 workers</span>
            </div>
          )}
        </div>
      </div>

      {/* Start Date + ETA */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Start Date *</label>
          <input
            required type="date"
            value={form.startDate}
            onChange={e => set('startDate', e.target.value)}
            className={inputClass}
          />
          {isBackToBack && form.predecessorId && (
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              Pre-filled from Set 1 ETA · adjustable
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>ETA</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={form.eta}
              onChange={e => set('eta', e.target.value)}
              className={cn(inputClass, 'flex-1')}
            />
            {etaSuggestion && (
              <button
                type="button"
                onClick={applyEtaSuggestion}
                title="Apply suggested ETA"
                className="flex-shrink-0 px-2 py-1.5 bg-brand-50 text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {etaSuggestion && (
            <p className="text-[10px] text-brand-600 mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Suggested: <strong>{formatDate(etaSuggestion.etaDate)}</strong> ({etaSuggestion.totalDays}d · {etaSuggestion.model})
              {etaSuggestion.isTier2 && ' ⚠ Tier 2 estimate'}
            </p>
          )}
        </div>
      </div>

      {/* Phase preview */}
      {etaSuggestion && form.locale && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            {isBackToBack ? <Link2 className="w-4 h-4 text-brand-500" /> : <Info className="w-4 h-4 text-brand-500" />}
            <span className="text-xs font-semibold text-slate-700">
              {isBackToBack ? 'Set 2 Phase Timeline — sequential' : `Estimated Phase Timeline (${etaSuggestion.model} model)`}
            </span>
          </div>

          {/* Head start summary row */}
          {isBackToBack && etaSuggestion.headStart && (
            <div className="mb-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <div className="w-2 h-2 rounded-sm border border-dashed border-blue-400 bg-blue-100 flex-shrink-0" />
              <span className="text-[11px] text-blue-700">
                <strong>{(etaSuggestion.headStart.headStartPct * 100).toFixed(1)}%</strong> of 1P+IAA pre-completed during Set 1's 2P window
                &nbsp;·&nbsp; {etaSuggestion.headStart.d1Rem}d remaining for full team
              </span>
            </div>
          )}
          <div className="space-y-1.5 text-xs">
            {[
              { label: '1P + IAA',  start: etaSuggestion.p1Start,  end: etaSuggestion.p1End,   days: etaSuggestion.d1,  color: 'bg-blue-400' },
              { label: 'Review',    start: etaSuggestion.rev1End,   end: etaSuggestion.rev1End, days: 1,                 color: 'bg-slate-300' },
              { label: '2nd Pass',  start: etaSuggestion.p2Start,   end: etaSuggestion.p2End,   days: etaSuggestion.d2,  color: 'bg-orange-400' },
              { label: 'PHI',       start: etaSuggestion.phiStart,  end: etaSuggestion.etaDate, days: etaSuggestion.dpf, color: 'bg-green-500' },
            ].map(ph => (
              <div key={ph.label} className="flex items-center gap-3">
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', ph.color)} />
                <span className="w-20 text-slate-600 font-medium">{ph.label}</span>
                <span className="text-slate-400">
                  {formatDate(ph.start)} → {formatDate(ph.end)}
                </span>
                <span className="text-slate-400">({ph.days}d)</span>
              </div>
            ))}
          </div>
          {etaSuggestion.model === 'Parallel' && (
            <p className="text-[10px] text-amber-600 mt-2">
              ⚡ Parallel model: 2P (4 users) and PHI Phase 1 (N−4 users) run simultaneously after IAA.
            </p>
          )}
        </div>
      )}

      {/* Revised ETA */}
      <div>
        <label className={labelClass}>Revised ETA (optional)</label>
        <input type="date" value={form.revisedEta} onChange={e => set('revisedEta', e.target.value)} className={inputClass} />
      </div>

      {/* Expiration Date */}
      <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
          <label className="text-xs font-semibold text-amber-800">Expiration Date (hard deadline)</label>
        </div>
        <input
          type="date"
          value={form.expirationDate}
          onChange={e => set('expirationDate', e.target.value)}
          className={inputClass}
        />
        <p className="text-[10px] text-amber-700">
          Hard deadline — different from ETA. Drives automatic risk escalation when within 30 days.
        </p>
        {/* Live risk preview */}
        {form.expirationDate && (() => {
          const effective = getEffectiveRisk(form.riskLevel, form.expirationDate, form.status)
          const overriding = effective !== form.riskLevel
          return (
            <div className={cn(
              'flex items-center gap-2 mt-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border',
              overriding
                ? 'bg-white border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600',
            )}>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-bold',
                RISK_COLORS[effective],
              )}>
                {RISK_LABELS[effective]}
              </span>
              <span className="text-slate-500">{expiryCountdownLabel(form.expirationDate)}</span>
              {overriding && (
                <span className="ml-auto text-amber-700 font-semibold text-[10px]">
                  ↑ Expiry override active
                </span>
              )}
            </div>
          )
        })()}
      </div>

      {/* Status + Priority + Risk */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value as WorksetStatus)} className={inputClass}>
            <option value="not-started">Not Started</option>
            <option value="in-progress">In Progress</option>
            <option value="at-risk">At Risk</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Priority</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value as Priority)} className={inputClass}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Risk Level</label>
          <select value={form.riskLevel} onChange={e => set('riskLevel', e.target.value as RiskLevel)} className={inputClass}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Blocked */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isBlocked} onChange={e => set('isBlocked', e.target.checked)} className="w-4 h-4 rounded text-red-500" />
          <span className="text-sm font-medium text-slate-700">Mark as Blocked</span>
        </label>
        {form.isBlocked && (
          <div>
            <label className={labelClass}>Blocker Description</label>
            <textarea value={form.blockerDescription} onChange={e => set('blockerDescription', e.target.value)} rows={2} className={inputClass} />
          </div>
        )}
      </div>

      {/* Escalated */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isEscalated} onChange={e => set('isEscalated', e.target.checked)} className="w-4 h-4 rounded text-orange-500" />
          <span className="text-sm font-medium text-slate-700">Mark as Escalated</span>
        </label>
        {form.isEscalated && (
          <div>
            <label className={labelClass}>Escalation Reason</label>
            <textarea value={form.escalationReason} onChange={e => set('escalationReason', e.target.value)} rows={2} className={inputClass} />
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Additional context, links, dependencies…" className={inputClass} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">{isEdit ? 'Save Changes' : 'Create Workset'}</Button>
      </div>
    </form>
  )
}

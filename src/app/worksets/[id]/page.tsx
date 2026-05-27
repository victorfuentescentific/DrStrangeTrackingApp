'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { WorksetForm } from '@/components/worksets/WorksetForm'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge, PriorityBadge, RiskBadge } from '@/components/worksets/StatusBadge'
import { useStore } from '@/lib/store'
import { formatDate, daysLabel, daysUntil, cn } from '@/lib/utils'
import { ROLE_PERMISSIONS } from '@/lib/types'
import { WORKFLOW_BG, PHASE_COLORS } from '@/lib/eta-calculator'
import { calculateETA } from '@/lib/eta-calculator'
import {
  ArrowLeft, Edit2, Trash2, Ban, ArrowUpRight, Clock,
  Layers, History, FileText, Info, Link2, Unlink, ChevronRight,
} from 'lucide-react'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  )
}

export default function WorksetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { worksets, updateWorkset, deleteWorkset, linkSuccessor, unlinkSuccessor, currentUser } = useStore()
  const perms = ROLE_PERMISSIONS[currentUser.role]
  const [isEditing, setIsEditing] = useState(false)
  const [isLinkingSuccessor, setIsLinkingSuccessor] = useState(false)
  const [selectedSuccessorId, setSelectedSuccessorId] = useState('')

  const ws = worksets.find(w => w.id === params.id)
  const successor   = worksets.find(w => w.predecessorId === params.id)
  const predecessor = ws?.predecessorId ? worksets.find(w => w.id === ws.predecessorId) : null
  const availableSuccessors = worksets.filter(w =>
    w.id !== params.id &&
    w.status !== 'completed' &&
    !w.predecessorId &&
    w.workflow === ws?.workflow &&
    w.locale === ws?.locale,
  )

  if (!ws) {
    return (
      <AppLayout title="Workset Not Found">
        <div className="text-center py-16">
          <p className="text-slate-500">This workset does not exist or has been deleted.</p>
          <Button variant="ghost" onClick={() => router.push('/worksets')} className="mt-4">
            ← Back to Worksets
          </Button>
        </div>
      </AppLayout>
    )
  }

  const effectiveEta = ws.revisedEta ?? ws.eta
  const days = daysUntil(effectiveEta)
  const phases = ws.phases

  const phaseRows = phases ? [
    { label: '1P + IAA', start: phases.p1Start,  end: phases.p1End,   days: phases.d1,  colorClass: PHASE_COLORS.p1 },
    { label: 'Review',   start: phases.rev1End,  end: phases.rev1End, days: 1,          colorClass: PHASE_COLORS.rev },
    { label: '2nd Pass', start: phases.p2Start,  end: phases.p2End,   days: phases.d2,  colorClass: PHASE_COLORS.p2 },
    { label: 'PHI',      start: phases.phiStart, end: phases.etaDate, days: phases.dpf, colorClass: PHASE_COLORS.phi },
  ] : []

  const handleDelete = () => {
    if (confirm(`Delete ${ws.worksetId} — "${ws.name}"? This cannot be undone.`)) {
      deleteWorkset(ws.id)
      router.push('/worksets')
    }
  }

  return (
    <AppLayout title={ws.worksetId} subtitle={ws.name}>
      <div className="max-w-4xl space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => router.push('/worksets')}>
            Back to Worksets
          </Button>
          <div className="flex gap-2">
            {perms.canEdit && (
              <Button variant="outline" size="sm" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
            {perms.canDelete && (
              <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={handleDelete}>
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Status + flags bar */}
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={ws.status} />
            <PriorityBadge priority={ws.priority} />
            <RiskBadge risk={ws.riskLevel} expirationDate={ws.expirationDate} status={ws.status} />
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', WORKFLOW_BG[ws.workflow])}>
              {ws.workflow}
            </span>
            {ws.isBlocked && (
              <Badge className="bg-red-100 text-red-700">
                <Ban className="w-3 h-3 mr-1 inline" />Blocked
              </Badge>
            )}
            {ws.isEscalated && (
              <Badge className="bg-orange-100 text-orange-700">
                <ArrowUpRight className="w-3 h-3 mr-1 inline" />Escalated
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className={cn(
                'font-medium',
                days < 0 ? 'text-red-600' : days <= 2 ? 'text-amber-600' : 'text-slate-600',
              )}>
                {ws.status === 'completed' ? '✓ Completed' : daysLabel(days)}
              </span>
            </div>
          </div>
        </div>

        {/* Main info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Core fields */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-500" /> Workset Details
            </h3>
            <dl className="space-y-4">
              <Field label="Workset Name">{ws.name}</Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Workset ID">
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">{ws.worksetId}</span>
                </Field>
                <Field label="Locale">{ws.locale}</Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Workflow">
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', WORKFLOW_BG[ws.workflow])}>
                    {ws.workflow}
                  </span>
                </Field>
                <Field label="Team">{ws.team}</Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Region">{ws.region}</Field>
                <Field label="Team Size">N = {ws.teamSize}</Field>
              </div>
              {ws.notes && <Field label="Notes">{ws.notes}</Field>}
            </dl>
          </div>

          {/* Right: Timeline + Flags */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-500" /> Timeline
              </h3>
              <dl className="space-y-3">
                <Field label="Start Date">{formatDate(ws.startDate)}</Field>
                <Field label="Original ETA">{formatDate(ws.eta)}</Field>
                {ws.revisedEta && (
                  <Field label="Revised ETA">
                    <span className="text-amber-600 font-medium">{formatDate(ws.revisedEta)}</span>
                  </Field>
                )}
                {ws.expirationDate && (
                  <Field label="Expiration Date">
                    <span className={
                      daysUntil(ws.expirationDate) <= 7
                        ? 'text-red-600 font-semibold'
                        : daysUntil(ws.expirationDate) <= 14
                          ? 'text-orange-600 font-medium'
                          : daysUntil(ws.expirationDate) <= 30
                            ? 'text-amber-600 font-medium'
                            : 'text-slate-700'
                    }>
                      {formatDate(ws.expirationDate)}
                      {ws.status !== 'completed' && (
                        <span className="ml-2 text-[10px] text-slate-400">
                          {daysUntil(ws.expirationDate) < 0
                            ? `(${Math.abs(daysUntil(ws.expirationDate))}d overdue)`
                            : daysUntil(ws.expirationDate) === 0
                              ? '(today)'
                              : `(${daysUntil(ws.expirationDate)}d left)`}
                        </span>
                      )}
                    </span>
                  </Field>
                )}
                {ws.completedAt && <Field label="Completed On">{formatDate(ws.completedAt)}</Field>}
                <Field label="Created">{formatDate(ws.createdAt)}</Field>
                <Field label="Last Updated">{formatDate(ws.updatedAt)}</Field>
              </dl>
            </div>

            {ws.isBlocked && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Ban className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">Blocker</span>
                </div>
                <p className="text-sm text-red-600">{ws.blockerDescription ?? 'No description provided.'}</p>
              </div>
            )}

            {ws.isEscalated && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-700">Escalation</span>
                </div>
                <p className="text-sm text-orange-600">{ws.escalationReason ?? 'Review required.'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Phase Timeline */}
        {phases && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-500" /> Phase Timeline
              <span className="ml-2 text-[10px] font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {phases.model} model · {phases.totalDays}d total
              </span>
              {phases.isTier2 && (
                <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Tier 2 estimate
                </span>
              )}
            </h3>
            <div className="space-y-2">
              {phaseRows.map(ph => (
                <div key={ph.label} className="flex items-center gap-4 text-sm">
                  <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', ph.colorClass)} />
                  <span className="w-24 font-medium text-slate-700">{ph.label}</span>
                  <span className="text-slate-500">
                    {formatDate(ph.start)}
                    {ph.start !== ph.end && <> → {formatDate(ph.end)}</>}
                  </span>
                  <span className="text-slate-400 text-xs">({ph.days}d)</span>
                </div>
              ))}
            </div>
            {phases.model === 'Parallel' && (
              <p className="text-[11px] text-amber-600 mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Parallel model: 2P team (4 users) and PHI Phase 1 (N−4 users) run simultaneously after IAA.
              </p>
            )}
          </div>
        )}

        {/* Predecessor badge (shown on Set 2) */}
        {predecessor && ws.phases?.headStart && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-brand-500" />
              <span className="text-sm font-semibold text-brand-700">Head Start — Successor of Set 1</span>
              <span className="ml-auto text-[10px] text-brand-500 bg-white border border-brand-200 px-2 py-0.5 rounded-full">
                {(ws.phases.headStart.headStartPct * 100).toFixed(1)}% pre-completed
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-brand-700">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-400 mb-0.5">Predecessor</p>
                <button
                  onClick={() => router.push(`/worksets/${predecessor.id}`)}
                  className="font-medium hover:underline flex items-center gap-1"
                >
                  {predecessor.worksetId} <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-400 mb-0.5">Head start window</p>
                <p>{formatDate(ws.phases.headStart.headStartBegin)} → {formatDate(ws.phases.headStart.headStartEnd)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-400 mb-0.5">WL pre-completed</p>
                <p>{ws.phases.headStart.headStartDone.toFixed(0)} / {ws.workflow === 'Scribing' ? '440 rep' : '1320+ min'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-400 mb-0.5">Remaining 1P+IAA</p>
                <p>{ws.phases.headStart.d1Rem}d (incl. +1d buffer)</p>
              </div>
            </div>
            {perms.canEdit && (
              <button
                onClick={() => unlinkSuccessor(ws.id)}
                className="mt-3 text-[10px] text-brand-400 hover:text-red-500 flex items-center gap-1"
              >
                <Unlink className="w-3 h-3" /> Unlink predecessor
              </button>
            )}
          </div>
        )}

        {/* Successor Workset (shown on Set 1) */}
        {ws.phases && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-brand-500" /> Successor Workset (Set 2)
            </h3>
            {successor ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => router.push(`/worksets/${successor.id}`)}
                    className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline"
                  >
                    <span className="font-mono text-xs bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded">
                      {successor.worksetId}
                    </span>
                    {successor.name}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  {perms.canEdit && (
                    <button
                      onClick={() => unlinkSuccessor(successor.id)}
                      className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-1"
                    >
                      <Unlink className="w-3 h-3" /> Unlink
                    </button>
                  )}
                </div>
                {successor.phases?.headStart && (
                  <div className="grid grid-cols-3 gap-3 text-xs bg-slate-50 rounded-lg p-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Head start</p>
                      <p className="font-semibold text-brand-600">
                        {(successor.phases.headStart.headStartPct * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Set 2 starts</p>
                      <p className="font-medium text-slate-700">{formatDate(successor.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Set 2 ETA</p>
                      <p className="font-medium text-slate-700">{formatDate(successor.eta)}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : perms.canEdit ? (
              <div>
                {!isLinkingSuccessor ? (
                  <button
                    onClick={() => setIsLinkingSuccessor(true)}
                    className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 border border-brand-200 rounded-lg px-3 py-2 hover:bg-brand-50 transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" /> Link a successor workset
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedSuccessorId}
                      onChange={e => setSelectedSuccessorId(e.target.value)}
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Select Set 2 workset…</option>
                      {availableSuccessors.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.worksetId} — {w.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="primary" size="sm"
                      onClick={() => {
                        if (selectedSuccessorId) {
                          linkSuccessor(ws.id, selectedSuccessorId)
                          setIsLinkingSuccessor(false)
                          setSelectedSuccessorId('')
                        }
                      }}
                      disabled={!selectedSuccessorId}
                    >
                      Link
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setIsLinkingSuccessor(false); setSelectedSuccessorId('') }}>
                      Cancel
                    </Button>
                  </div>
                )}
                {availableSuccessors.length === 0 && !isLinkingSuccessor && (
                  <p className="text-xs text-slate-400 mt-1">
                    No available worksets with the same workflow and locale to link.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No successor linked.</p>
            )}
          </div>
        )}

        {/* Audit Trail */}
        {ws.auditTrail.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-brand-500" /> Audit Trail
            </h3>
            <div className="space-y-3">
              {[...ws.auditTrail].reverse().map(entry => (
                <div key={entry.id} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700">{entry.changedBy}</span>
                      <span className="text-slate-400">changed</span>
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{entry.field}</span>
                      {entry.oldValue && (
                        <>
                          <span className="text-slate-400">from</span>
                          <span className="text-slate-500 line-through text-xs">{entry.oldValue}</span>
                        </>
                      )}
                      <span className="text-slate-400">to</span>
                      <span className="font-medium text-slate-800">{entry.newValue}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400">
                        {new Date(entry.changedAt).toLocaleString()}
                      </span>
                      {entry.reason && (
                        <span className="text-[11px] text-slate-400">· {entry.reason}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title={`Edit ${ws.worksetId}`}
        size="lg"
      >
        <WorksetForm
          initial={ws}
          isEdit
          onCancel={() => setIsEditing(false)}
          onSubmit={(form) => {
            const n = parseInt(form.teamSize) || 11
            const newPhases = form.locale && form.startDate && n >= 5
              ? calculateETA(form.workflow, form.locale, n, form.startDate)
              : undefined
            updateWorkset(ws.id, {
              name: form.name,
              workflow: form.workflow,
              locale: form.locale,
              team: form.team,
              region: form.region,
              teamSize: n,
              startDate: form.startDate,
              eta: form.eta,
              revisedEta: form.revisedEta || undefined,
              phases: newPhases,
              status: form.status,
              priority: form.priority,
              riskLevel: form.riskLevel,
              expirationDate: form.expirationDate || undefined,
              isBlocked: form.isBlocked,
              blockerDescription: form.blockerDescription || undefined,
              isEscalated: form.isEscalated,
              escalationReason: form.escalationReason || undefined,
              notes: form.notes,
              completedAt: form.status === 'completed' && !ws.completedAt
                ? new Date().toISOString().split('T')[0]
                : ws.completedAt,
            }, 'Manual edit via UI')
            setIsEditing(false)
          }}
        />
      </Modal>
    </AppLayout>
  )
}

'use client'

import { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { WorksetStatus, Priority, RiskLevel, WorkflowType, Region } from '@/lib/types'

const WORKFLOWS: { value: WorkflowType | 'all'; label: string }[] = [
  { value: 'all',      label: 'All Workflows' },
  { value: 'DAX',      label: 'DAX' },
  { value: 'DMO',      label: 'DMO' },
  { value: 'Scribing', label: 'Scribing' },
]

const REGIONS: { value: Region | 'all'; label: string }[] = [
  { value: 'all', label: 'All Regions' },
  { value: 'EU',  label: 'EU' },
  { value: 'US',  label: 'US' },
  { value: 'IN',  label: 'IN' },
]

const STATUSES: { value: WorksetStatus | 'all'; label: string }[] = [
  { value: 'all',         label: 'All Statuses' },
  { value: 'not-started', label: 'Not Started' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'at-risk',     label: 'At Risk' },
  { value: 'blocked',     label: 'Blocked' },
  { value: 'overdue',     label: 'Overdue' },
  { value: 'completed',   label: 'Completed' },
]

const PRIORITIES: { value: Priority | 'all'; label: string }[] = [
  { value: 'all',      label: 'All Priorities' },
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const RISKS: { value: RiskLevel | 'all'; label: string }[] = [
  { value: 'all',      label: 'All Risk Levels' },
  { value: 'low',      label: 'Low Risk' },
  { value: 'medium',   label: 'Medium Risk' },
  { value: 'high',     label: 'High Risk' },
  { value: 'critical', label: 'Critical Risk' },
]

export function WorksetFilters() {
  const { filters, setFilter, clearFilters, worksets } = useStore()

  // Derive locale options from worksets already in the store — no pre-defined list
  const localeOptions = useMemo(
    () => [...new Set(worksets.map(w => w.locale))].filter(Boolean).sort(),
    [worksets],
  )

  const hasActiveFilters =
    filters.search || filters.workflow !== 'all' || filters.region !== 'all' || filters.locale ||
    filters.status !== 'all' || filters.priority !== 'all' || filters.riskLevel !== 'all' ||
    filters.showBlockedOnly || filters.showEscalatedOnly || filters.dateFrom || filters.dateTo

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      {/* Row 1: Search + quick toggles */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search worksets, locale, workflow…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          {filters.search && (
            <button onClick={() => setFilter('search', '')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showBlockedOnly}
            onChange={e => setFilter('showBlockedOnly', e.target.checked)}
            className="w-4 h-4 rounded text-brand-600"
          />
          Blocked only
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showEscalatedOnly}
            onChange={e => setFilter('showEscalatedOnly', e.target.checked)}
            className="w-4 h-4 rounded text-brand-600"
          />
          Escalated only
        </label>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} icon={<X className="w-3 h-3" />}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Row 2: Dropdowns */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filters.workflow}
          onChange={e => setFilter('workflow', e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          {WORKFLOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>

        <select
          value={filters.region}
          onChange={e => setFilter('region', e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <select
          value={filters.status}
          onChange={e => setFilter('status', e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select
          value={filters.priority}
          onChange={e => setFilter('priority', e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <select
          value={filters.riskLevel}
          onChange={e => setFilter('riskLevel', e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          {RISKS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <select
          value={filters.locale}
          onChange={e => setFilter('locale', e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="">All Locales</option>
          {localeOptions.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

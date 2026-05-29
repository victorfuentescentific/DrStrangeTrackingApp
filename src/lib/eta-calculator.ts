import { WorkflowType, PhaseTimeline } from './types'

// ─── v4.2 Model Constants ────────────────────────────────────────────────────
// v4.2 change: IAA merged into 1P phase (d1 now covers 1P+IAA combined workload)
export const TP1_DAX  = 27   // DAX 1P rate: min audio/p/day (updated v4.1)
export const TP1_DMO  = 25   // DMO 1P rate: min audio/p/day
export const TR2      = 60   // 2P transcription rate: min audio/p/day
export const SR2_2P   = 6    // 2P scribing rate: rep/p/day (ALL locales incl. FR)
export const PHI_RATE = 10   // PHI rate: wu/p/day (all workflows)
export const TP_2P    = 4    // 2P team size: always fixed at 4
const REV      = 1    // Review gate days (one gate after 1P+IAA, one after 2P)

// ─── Corpus Sizes ────────────────────────────────────────────────────────────
// iaa retained for reference; d1 is computed from p1+iaa combined
export const CORPUS: Record<WorkflowType, { p1: number; iaa: number; p2: number; phi: number }> = {
  DAX:     { p1: 2400, iaa: 240,  p2: 240,  phi: 200 },
  DMO:     { p1: 1200, iaa: 120,  p2: 1200, phi: 100 },
  Scribing:{ p1: 400,  iaa: 40,   p2: 40,   phi: 400 },
}

// ─── Known Tier 1 Team Sizes (confirmed v4.1) ─────────────────────────────
export const TIER1_TEAM_SIZES: Record<string, { trans: number; scrib: number }> = {
  en_GB: { trans: 6,  scrib: 9  },
  de_DE: { trans: 11, scrib: 11 },
  nl_NL: { trans: 11, scrib: 10 },
  fr_FR: { trans: 11, scrib: 11 },
  // Tier 2 (Nordic) locales — 3-person part-time teams
  da_DK: { trans: 3,  scrib: 3  },
  nb_NO: { trans: 3,  scrib: 3  },
  fi_FI: { trans: 3,  scrib: 3  },
  sv_SE: { trans: 3,  scrib: 3  },
}

// Tier 2 locales (4hr/day — ETA is estimated, not validated)
export const TIER2_LOCALES = ['da_DK', 'nb_NO', 'fi_FI', 'sv_SE']

// FR scribing 1P rate exception (confirmed in v4 model)
function getScrib1PRate(locale: string): number {
  return locale === 'fr_FR' ? 4 : 6
}

export function get1PRate(workflow: WorkflowType, locale: string): number {
  if (workflow === 'DAX') return TP1_DAX
  if (workflow === 'DMO') return TP1_DMO
  return getScrib1PRate(locale)
}

// Returns the production unit for a given workflow
export function getProductionUnit(workflow: WorkflowType): 'min audio' | 'rep' {
  return workflow === 'Scribing' ? 'rep' : 'min audio'
}

export function getDefaultTeamSize(locale: string, workflow: WorkflowType): number {
  const known = TIER1_TEAM_SIZES[locale]
  if (known) return workflow === 'Scribing' ? known.scrib : known.trans
  return 11 // default for unknown locales
}

// Snap a date forward to the nearest working day (no-op if already Mon–Fri)
export function toWorkingDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export function addWorkingDays(dateStr: string, days: number): string {
  // Always normalise input — if dateStr is a weekend, snap forward before counting
  if (days <= 0) return toWorkingDay(dateStr)
  const d = new Date(dateStr + 'T12:00:00')
  let remaining = days
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) remaining--
  }
  return d.toISOString().split('T')[0]
}

// Shift dateStr backward by N working days
function subtractWorkingDays(dateStr: string, days: number): string {
  if (days <= 0) return toWorkingDay(dateStr)
  const d = new Date(dateStr + 'T12:00:00')
  let remaining = days
  while (remaining > 0) {
    d.setDate(d.getDate() - 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) remaining--
  }
  return d.toISOString().split('T')[0]
}

// Signed working-day count from `from` (exclusive) to `to` (inclusive).
// Positive = forward, negative = backward.
function workingDayDelta(from: string, to: string): number {
  if (from === to) return 0
  const f = new Date(from + 'T12:00:00')
  const t = new Date(to   + 'T12:00:00')
  const forward = t > f
  let count = 0
  const d = new Date(f)
  while (forward ? d.getTime() < t.getTime() : d.getTime() > t.getTime()) {
    d.setDate(d.getDate() + (forward ? 1 : -1))
    if (d.getDay() !== 0 && d.getDay() !== 6) count++
  }
  return forward ? count : -count
}

export function calculateETA(
  workflow: WorkflowType,
  locale: string,
  teamSize: number,
  startDate: string,
): PhaseTimeline {
  // en_GB exception: operational throughput matches nl_NL despite smaller actual team.
  // Do NOT generalise — this is a confirmed locale-specific override, not a formula change.
  if (locale === 'en_GB') {
    const nlN = workflow === 'Scribing' ? 10 : 11
    return calculateETA(workflow, 'nl_NL', nlN, startDate)
  }

  const n   = Math.max(teamSize, TP_2P + 1) // minimum N = 5 to have at least 1 PHI Ph.1 worker
  const c   = CORPUS[workflow]
  const isTier2 = TIER2_LOCALES.includes(locale)

  // ─── Phase durations (v4.2: d1 = 1P + IAA combined) ─────────────────────
  let d1: number  // 1P + IAA combined duration
  let d2: number

  if (workflow === 'DAX') {
    d1 = Math.ceil((c.p1 + c.iaa) / (n * TP1_DAX))
    d2 = Math.ceil(c.p2            / (TP_2P * TR2))
  } else if (workflow === 'DMO') {
    d1 = Math.ceil((c.p1 + c.iaa) / (n * TP1_DMO))
    d2 = Math.ceil(c.p2            / (TP_2P * TR2))
  } else {
    const sr1 = getScrib1PRate(locale)
    d1 = Math.ceil((c.p1 + c.iaa) / (n * sr1))
    d2 = Math.ceil(c.p2            / (TP_2P * SR2_2P))
  }

  const dpf = Math.ceil(c.phi / (n * PHI_RATE)) // sequential PHI duration

  // ─── Total duration ───────────────────────────────────────────────────────
  let totalDays: number
  const model = workflow === 'DMO' ? 'Sequential' : 'Parallel'

  if (model === 'Sequential') {
    totalDays = d1 + REV + d2 + REV + dpf
  } else {
    const d2r  = d2 + REV
    const rem  = n - TP_2P
    const wu1  = rem * PHI_RATE * d2r
    const wu_r = Math.max(0, c.phi - wu1)
    const pp2  = wu_r > 0 ? Math.ceil(wu_r / (n * PHI_RATE)) : 0
    const pp   = d2r + pp2
    totalDays  = d1 + REV + pp
  }

  // ─── Build date timeline ──────────────────────────────────────────────────
  let offset = 0

  const p1Start = addWorkingDays(startDate, offset)
  offset += d1
  const p1End   = addWorkingDays(startDate, offset - 1)
  const rev1End = addWorkingDays(startDate, offset)       // REV gate after 1P+IAA
  offset += REV

  // 2P starts immediately after REV
  const p2Start = addWorkingDays(startDate, offset)
  const p2End   = addWorkingDays(startDate, offset + d2 - 1)
  const rev2End = addWorkingDays(startDate, offset + d2)

  // PHI start: parallel = same day as p2; sequential = day after rev2
  const phiStart = model === 'Sequential'
    ? addWorkingDays(startDate, offset + d2 + REV)
    : addWorkingDays(startDate, offset)   // parallel: PHI Phase 1 starts same day as 2P

  const etaDate = addWorkingDays(startDate, totalDays - 1)

  return {
    p1Start, p1End, rev1End,
    p2Start, p2End, rev2End,
    phiStart,
    etaDate,
    totalDays,
    d1, d2, dpf,
    model,
    isTier2,
  }
}

// ─── Two-set / Head Start model ──────────────────────────────────────────────

// Count working days between two date strings, both inclusive
export function countWorkingDays(from: string, to: string): number {
  const start = new Date(from + 'T12:00:00')
  const end   = new Date(to   + 'T12:00:00')
  if (end < start) return 0
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/**
 * Calculate the phase timeline for a successor (Set 2) workset, accounting for the
 * head start completed by non-2P workers during Set 1's 2P + REV window.
 *
 * Rules:
 *  - en_GB exception applies: GB uses NL-equivalent effective team size
 *  - d1_rem includes +1 working day safety buffer
 *  - Set 2 uses the same Parallel/Sequential model as the standard v4.2 assignment
 *  - Set 2 starts the working day after Set 1's etaDate
 */
export function calculateSuccessorETA(
  set1Phases: PhaseTimeline,
  workflow: WorkflowType,
  locale: string,
  n: number,
): PhaseTimeline {
  // Apply en_GB exception
  const effectiveLocale = locale === 'en_GB' ? 'nl_NL' : locale
  const effectiveN = locale === 'en_GB'
    ? (workflow === 'Scribing' ? 10 : 11)
    : Math.max(n, TP_2P + 1)

  const c      = CORPUS[workflow]
  const totalWL = c.p1 + c.iaa
  const rate1P  = get1PRate(workflow, effectiveLocale)

  // Head start: non-2P workers produced this much of Set 2's 1P+IAA during Set 1's d2r
  const d2rDays       = countWorkingDays(set1Phases.p2Start, set1Phases.rev2End)
  const nonTP         = effectiveN - TP_2P
  const headStartDone = nonTP * rate1P * d2rDays
  const headStartPct  = Math.min(headStartDone / totalWL, 1)

  // Remaining 1P+IAA for the full team after head start, with +1d safety buffer
  const remaining  = Math.max(0, totalWL - headStartDone)
  const d1RemRaw   = remaining > 0 ? Math.ceil(remaining / (effectiveN * rate1P)) : 0
  const d1Rem      = d1RemRaw + 1

  // d2 and dpf identical to standard model
  const d2 = workflow === 'Scribing'
    ? Math.ceil(c.p2 / (TP_2P * SR2_2P))
    : Math.ceil(c.p2 / (TP_2P * TR2))
  const dpf = Math.ceil(c.phi / (effectiveN * PHI_RATE))

  const model    = workflow === 'DMO' ? 'Sequential' : 'Parallel'
  const isTier2  = TIER2_LOCALES.includes(locale)
  const set2Start = addWorkingDays(set1Phases.etaDate, 1)

  // Build phase dates (same logic as calculateETA but d1 = d1Rem)
  let offset = 0
  const p1Start = set2Start
  const p1End   = addWorkingDays(set2Start, Math.max(0, d1Rem - 1))
  const rev1End = addWorkingDays(set2Start, d1Rem)
  offset = d1Rem + REV

  const p2Start = addWorkingDays(set2Start, offset)
  const p2End   = addWorkingDays(set2Start, offset + d2 - 1)
  const rev2End = addWorkingDays(set2Start, offset + d2)

  let phiStart: string
  let totalDays: number

  if (model === 'Sequential') {
    phiStart  = addWorkingDays(set2Start, offset + d2 + REV)
    totalDays = d1Rem + REV + d2 + REV + dpf
  } else {
    phiStart = p2Start
    const d2r  = d2 + REV
    const rem  = effectiveN - TP_2P
    const wu1  = rem * PHI_RATE * d2r
    const wu_r = Math.max(0, c.phi - wu1)
    const pp2  = wu_r > 0 ? Math.ceil(wu_r / (effectiveN * PHI_RATE)) : 0
    totalDays  = d1Rem + REV + d2r + pp2
  }

  const etaDate = addWorkingDays(set2Start, totalDays - 1)

  return {
    p1Start, p1End, rev1End,
    p2Start, p2End, rev2End,
    phiStart, etaDate,
    totalDays,
    d1: d1Rem, d2, dpf,
    model, isTier2,
    headStart: {
      headStartBegin: set1Phases.p2Start,
      headStartEnd:   set1Phases.rev2End,
      headStartDone,
      headStartPct,
      d1Rem,
    },
  }
}

// ─── Manual phase adjustment ─────────────────────────────────────────────────
// Shifts all phase dates that come after `field` by the same calendar delta.
// Used when a user manually overrides a phase end date in the Gantt/detail view.
export type EditablePhaseField = 'p1End' | 'rev1End' | 'p2Start' | 'p2End' | 'rev2End' | 'phiStart' | 'etaDate'

export function adjustPhaseDate(
  phases: PhaseTimeline,
  field: EditablePhaseField,
  newDate: string,
): PhaseTimeline {
  if (newDate === phases[field]) return phases
  // Calculate the signed working-day difference and shift downstream dates by the
  // same number of working days — never by raw calendar days, which would push
  // dates onto weekends when the delta spans a Friday.
  const delta = workingDayDelta(phases[field] as string, newDate)
  if (delta === 0) return phases
  const shift = (d: string) =>
    delta > 0 ? addWorkingDays(d, delta) : subtractWorkingDays(d, -delta)

  switch (field) {
    case 'p1End':
      return { ...phases, p1End: newDate, rev1End: shift(phases.rev1End), p2Start: shift(phases.p2Start), p2End: shift(phases.p2End), rev2End: shift(phases.rev2End), phiStart: shift(phases.phiStart), etaDate: shift(phases.etaDate) }
    case 'rev1End':
      return { ...phases, rev1End: newDate, p2Start: shift(phases.p2Start), p2End: shift(phases.p2End), rev2End: shift(phases.rev2End), phiStart: shift(phases.phiStart), etaDate: shift(phases.etaDate) }
    case 'p2Start':
      return { ...phases, p2Start: newDate, p2End: shift(phases.p2End), rev2End: shift(phases.rev2End), phiStart: shift(phases.phiStart), etaDate: shift(phases.etaDate) }
    case 'p2End':
      return { ...phases, p2End: newDate, rev2End: shift(phases.rev2End), phiStart: shift(phases.phiStart), etaDate: shift(phases.etaDate) }
    case 'rev2End':
      return { ...phases, rev2End: newDate, phiStart: shift(phases.phiStart), etaDate: shift(phases.etaDate) }
    case 'phiStart':
      return { ...phases, phiStart: newDate, etaDate: shift(phases.etaDate) }
    case 'etaDate':
    default:
      return { ...phases, etaDate: newDate }
  }
}

// ─── Phase label helpers ──────────────────────────────────────────────────────
export const PHASE_LABELS = {
  p1:  '1P + IAA',
  p2:  '2P Annotation',
  phi: 'PHI',
  rev: 'Review',
}

export const PHASE_COLORS = {
  p1:  'bg-blue-500',
  p2:  'bg-orange-400',
  phi: 'bg-green-500',
  rev: 'bg-slate-300',
}

// Hex equivalents of PHASE_COLORS — single source of truth for inline styles
export const PHASE_HEX: Record<'p1' | 'p2' | 'phi' | 'rev', string> = {
  p1:  '#3b82f6',
  p2:  '#f97316',
  phi: '#22c55e',
  rev: '#94a3b8',
}

// Returns the first working day after `etaDate` — the canonical Set 2 start date
export function getSuccessorStartDate(etaDate: string): string {
  return addWorkingDays(etaDate, 1)
}

export const WORKFLOW_COLORS: Record<WorkflowType, string> = {
  DAX:     '#6366f1',
  DMO:     '#f59e0b',
  Scribing:'#10b981',
}

export const WORKFLOW_BG: Record<WorkflowType, string> = {
  DAX:     'bg-indigo-100 text-indigo-700',
  DMO:     'bg-amber-100 text-amber-700',
  Scribing:'bg-green-100 text-green-700',
}

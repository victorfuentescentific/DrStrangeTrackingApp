import { Workset } from './types'
import { TP_2P, PHI_RATE, TR2, SR2_2P, CORPUS, countWorkingDays, get1PRate, getProductionUnit } from './eta-calculator'

export type ProductionUnit = 'min audio' | 'rep' | 'WU'

// Single source of truth for phase label strings — import in UI to avoid mismatch
export const PHASE_LABEL = {
  P1:      '1P+IAA',
  REV1:    'REV gate (1P→2P)',
  P2:      '2P',
  P2_PHI1: '2P + PHI Ph.1',
  REV2:    'REV gate (2P→PHI)',
  PHI:     'PHI',
  PHI1:    'PHI Ph.1',
  PHI2:    'PHI Ph.2',
  NOT_STARTED: 'Not started',
  ETA_PASSED:  'ETA passed',
  NO_PHASES:   'No phases',
} as const

export interface PhaseRow {
  phase:            string
  hc:               number
  rate:             number   // per person per day
  output:           number   // hc × rate
  unit:             ProductionUnit
  corpusTotal:      number
  corpusElapsed:    number   // estimated work done so far
  corpusRemaining:  number   // estimated remaining
  daysToFinish:     number
}

export interface WorksetProjection {
  workset:      Workset
  phaseRows:    PhaseRow[]
  phaseLabel:   string
  daysLeft:     number
  weeklyOutput: { unit: ProductionUnit; amount: number }[]
  isIdle:       boolean
}

/** Working days remaining in the current Mon–Fri week, starting from today (inclusive). */
export function workingDaysRemainingThisWeek(today: Date): number {
  const dow = today.getDay()
  if (dow === 0 || dow === 6) return 5  // weekend → count next full Mon–Fri
  return 6 - dow                         // Mon=5, Tue=4, Wed=3, Thu=2, Fri=1
}

/** ISO Monday of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d   = new Date(date)
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
  return d
}

function makePhaseRow(
  phase: string,
  hc: number,
  rate: number,
  unit: ProductionUnit,
  corpusTotal: number,
  phaseStartDate: string,
  today: string,
): PhaseRow {
  const output          = hc * rate
  const elapsed         = Math.max(0, countWorkingDays(phaseStartDate, today))
  const corpusElapsed   = Math.min(elapsed * output, corpusTotal)
  const corpusRemaining = Math.max(0, corpusTotal - corpusElapsed)
  const daysToFinish    = output > 0 ? Math.ceil(corpusRemaining / output) : 0
  return { phase, hc, rate, output, unit, corpusTotal, corpusElapsed, corpusRemaining, daysToFinish }
}

/**
 * Determine what phases a workset is running today and compute daily/weekly output.
 * Pass `hcOverride` to model a different headcount (e.g., leave adjustments).
 */
export function computeProjection(ws: Workset, today: string, hcOverride?: number): WorksetProjection {
  const daysLeft = workingDaysRemainingThisWeek(new Date(today + 'T12:00:00'))
  const idle     = (phaseLabel: string): WorksetProjection =>
    ({ workset: ws, phaseRows: [], phaseLabel, daysLeft, weeklyOutput: [], isIdle: true })

  if (!ws.phases) return idle(PHASE_LABEL.NO_PHASES)

  const p    = ws.phases
  const n    = hcOverride ?? ws.teamSize
  const d    = today
  const unit = getProductionUnit(ws.workflow)
  const c    = CORPUS[ws.workflow]

  if (d < p.p1Start) return idle(PHASE_LABEL.NOT_STARTED)
  if (d > p.etaDate) return idle(PHASE_LABEL.ETA_PASSED)

  if (d <= p.p1End) {
    const rate = get1PRate(ws.workflow, ws.locale)
    const row  = makePhaseRow(PHASE_LABEL.P1, n, rate, unit, c.p1 + c.iaa, p.p1Start, d)
    return { workset: ws, phaseRows: [row], phaseLabel: PHASE_LABEL.P1, daysLeft, weeklyOutput: [{ unit, amount: row.output * daysLeft }], isIdle: false }
  }

  if (d <= p.rev1End) return idle(PHASE_LABEL.REV1)

  if (d <= p.p2End) {
    const rate2P = ws.workflow === 'Scribing' ? SR2_2P : TR2
    const row2P  = makePhaseRow(PHASE_LABEL.P2, TP_2P, rate2P, unit, c.p2, p.p2Start, d)
    const rows   = [row2P]
    const weekly: WorksetProjection['weeklyOutput'] = [{ unit, amount: row2P.output * daysLeft }]

    if (p.model === 'Parallel') {
      const phi1HC = Math.max(0, n - TP_2P)
      if (phi1HC > 0) {
        const rowPhi1 = makePhaseRow(PHASE_LABEL.PHI1, phi1HC, PHI_RATE, 'WU', c.phi, p.phiStart, d)
        rows.push(rowPhi1)
        weekly.push({ unit: 'WU', amount: rowPhi1.output * daysLeft })
      }
    }

    return { workset: ws, phaseRows: rows, phaseLabel: p.model === 'Parallel' ? PHASE_LABEL.P2_PHI1 : PHASE_LABEL.P2, daysLeft, weeklyOutput: weekly, isIdle: false }
  }

  if (d <= p.rev2End) return idle(PHASE_LABEL.REV2)

  const rowPhi = makePhaseRow(PHASE_LABEL.PHI, n, PHI_RATE, 'WU', c.phi, p.phiStart, d)
  return {
    workset: ws,
    phaseRows: [rowPhi],
    phaseLabel: p.model === 'Parallel' ? PHASE_LABEL.PHI2 : PHASE_LABEL.PHI,
    daysLeft,
    weeklyOutput: [{ unit: 'WU', amount: rowPhi.output * daysLeft }],
    isIdle: false,
  }
}

/** Aggregate weekly output totals across all projections. */
export function sumWeeklyOutput(projections: WorksetProjection[]): Record<ProductionUnit, number> {
  const totals: Record<ProductionUnit, number> = { 'min audio': 0, rep: 0, WU: 0 }
  for (const proj of projections) {
    for (const { unit, amount } of proj.weeklyOutput) {
      totals[unit] += amount
    }
  }
  return totals
}

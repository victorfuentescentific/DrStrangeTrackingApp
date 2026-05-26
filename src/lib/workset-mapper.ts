import type { Workset } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// toWorkset — single source of truth for converting a Supabase DB row
// (snake_case columns) to the camelCase Workset type used throughout the app.
//
// Import this from any server-side route that loads worksets from the DB.
// Previously this function was duplicated in:
//   - src/app/api/projections/snapshots/route.ts
//   - src/app/api/cron/projection-snapshot/route.ts
// ─────────────────────────────────────────────────────────────────────────────

export function toWorkset(row: Record<string, unknown>): Workset {
  return {
    id:                 row.id as string,
    worksetId:          row.workset_id as string,
    name:               row.name as string,
    workflow:           row.workflow as Workset['workflow'],
    locale:             row.locale as string,
    team:               row.team as Workset['team'],
    region:             row.region as Workset['region'],
    teamSize:           row.team_size as number,
    status:             row.status as Workset['status'],
    priority:           row.priority as Workset['priority'],
    riskLevel:          row.risk_level as Workset['riskLevel'],
    startDate:          row.start_date as string,
    eta:                row.eta as string,
    revisedEta:         (row.revised_eta  as string | null) ?? undefined,
    phases:             (row.phases        as Workset['phases'] | null) ?? undefined,
    isBlocked:          row.is_blocked as boolean,
    blockerDescription: (row.blocker_description  as string | null) ?? undefined,
    isEscalated:        row.is_escalated as boolean,
    escalationReason:   (row.escalation_reason    as string | null) ?? undefined,
    notes:              (row.notes as string) ?? '',
    completedAt:        (row.completed_at  as string | null) ?? undefined,
    predecessorId:      (row.predecessor_id as string | null) ?? undefined,
    createdAt:          row.created_at as string,
    updatedAt:          row.updated_at as string,
    auditTrail:         (row.audit_trail as Workset['auditTrail']) ?? [],
  }
}

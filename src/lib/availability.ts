import 'server-only'
import { db } from './db'
export type {
  AvailabilityStatus,
  AvailabilitySubmission,
} from './availability-types'
export {
  STATUS_CONFIG,
  FTE_ONLY_STATUSES,
  FTE_STATUS_HOURS,
} from './availability-types'
import type { AvailabilityStatus, AvailabilitySubmission } from './availability-types'

function toSubmission(row: Record<string, unknown>): AvailabilitySubmission {
  return {
    id:                 row.id as string,
    userId:             row.user_id as string,
    date:               row.date as string,
    status:             row.status as AvailabilityStatus,
    availabilityHours:  row.availability_hours as number | null,
    estimatedStartCet:  row.estimated_start_cet as string | null,
    locale:             row.locale as string | null,
    workflow:           row.workflow as string | null,
    notes:              (row.notes as string) ?? '',
    submittedBy:        row.submitted_by as string,
    importBatchId:      row.import_batch_id as string | null,
    flaggedForReview:   row.flagged_for_review as boolean,
    flagReason:         row.flag_reason as string | null,
    createdAt:          row.created_at as string,
    updatedAt:          row.updated_at as string,
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAvailabilityByUser(
  userId: string,
  from: string,
  to: string
): Promise<AvailabilitySubmission[]> {
  const { data, error } = await db
    .from('availability_submissions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  if (error) throw new Error(`getAvailabilityByUser: ${error.message}`)
  return (data ?? []).map(toSubmission)
}

export async function getAvailabilityByDate(date: string): Promise<AvailabilitySubmission[]> {
  const { data, error } = await db
    .from('availability_submissions')
    .select('*')
    .eq('date', date)
    .order('user_id', { ascending: true })

  if (error) throw new Error(`getAvailabilityByDate: ${error.message}`)
  return (data ?? []).map(toSubmission)
}

export async function getAvailabilityRange(
  from: string,
  to: string,
  filters?: { locale?: string; workflow?: string; userId?: string }
): Promise<AvailabilitySubmission[]> {
  let query = db
    .from('availability_submissions')
    .select('*')
    .gte('date', from)
    .lte('date', to)

  if (filters?.locale)   query = query.eq('locale', filters.locale)
  if (filters?.workflow) query = query.eq('workflow', filters.workflow)
  if (filters?.userId)   query = query.eq('user_id', filters.userId)

  const { data, error } = await query.order('date', { ascending: true })
  if (error) throw new Error(`getAvailabilityRange: ${error.message}`)
  return (data ?? []).map(toSubmission)
}

// ── Upsert ────────────────────────────────────────────────────────────────────

export async function upsertAvailability(
  sub: Omit<AvailabilitySubmission, 'id' | 'createdAt' | 'updatedAt' | 'flaggedForReview' | 'flagReason' | 'importBatchId'>
): Promise<AvailabilitySubmission> {
  const row = {
    user_id:              sub.userId,
    date:                 sub.date,
    status:               sub.status,
    availability_hours:   sub.availabilityHours ?? null,
    estimated_start_cet:  sub.estimatedStartCet ?? null,
    locale:               sub.locale ?? null,
    workflow:             sub.workflow ?? null,
    notes:                sub.notes ?? '',
    submitted_by:         sub.submittedBy,
    updated_at:           new Date().toISOString(),
  }

  const { data, error } = await db
    .from('availability_submissions')
    .upsert(row, { onConflict: 'user_id,date' })
    .select()
    .single()

  if (error) throw new Error(`upsertAvailability: ${error.message}`)
  return toSubmission(data)
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteAvailability(id: string): Promise<void> {
  const { error } = await db
    .from('availability_submissions')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`deleteAvailability: ${error.message}`)
}

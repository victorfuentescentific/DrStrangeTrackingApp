import 'server-only'
import { db } from './db'

export interface AvailabilitySubmission {
  id: string
  userId: string
  date: string                // YYYY-MM-DD
  status: AvailabilityStatus
  availabilityHours: number | null
  estimatedStartCet: string | null  // HH:MM
  locale: string | null
  workflow: string | null
  notes: string
  submittedBy: string
  importBatchId: string | null
  flaggedForReview: boolean
  flagReason: string | null
  createdAt: string
  updatedAt: string
}

export type AvailabilityStatus =
  | 'AVAILABLE'
  | 'PTO'
  | 'BH'
  | 'NO'
  | 'SL'
  | 'WA'
  | 'UL'
  | 'DH'
  | 'PATERNITY'
  | 'OTHER'

// Status display config — colour + label split by employee type
export const STATUS_CONFIG: Record<AvailabilityStatus, {
  label: string
  // FTE: NO = working normally (grey); FL: NO = unavailable (red)
  color: string
  ftColor?: string
}> = {
  AVAILABLE:  { label: 'Available',       color: 'bg-green-100 text-green-800' },
  PTO:        { label: 'PTO',             color: 'bg-blue-100 text-blue-800' },
  BH:         { label: 'Bank Holiday',    color: 'bg-purple-100 text-purple-800' },
  NO:         { label: 'Not Available',   color: 'bg-red-100 text-red-800',
                ftColor: 'bg-gray-100 text-gray-600' },
  SL:         { label: 'Sick Leave',      color: 'bg-orange-100 text-orange-800' },
  WA:         { label: 'Working Abroad',  color: 'bg-teal-100 text-teal-800' },
  UL:         { label: 'Unpaid Leave',    color: 'bg-yellow-100 text-yellow-800' },
  DH:         { label: 'Doctor Hours',    color: 'bg-pink-100 text-pink-800' },
  PATERNITY:  { label: 'Paternity',       color: 'bg-indigo-100 text-indigo-800' },
  OTHER:      { label: 'Other',           color: 'bg-gray-100 text-gray-600' },
}

// Statuses available to freelancers only
export const FTE_ONLY_STATUSES: AvailabilityStatus[] = ['PTO', 'UL', 'DH', 'PATERNITY', 'OTHER']

// Hours that a given status contributes (FTE logic)
export const FTE_STATUS_HOURS: Record<string, number> = {
  AVAILABLE: -1,   // use availability_hours field
  WA:        8,
  NO:        8,    // FTE NO = normal working day
  PTO:       0,
  BH:        0,
  SL:        0,
  UL:        0,
  DH:        0,
  PATERNITY: 0,
  OTHER:     0,
}

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

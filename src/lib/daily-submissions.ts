import 'server-only'
import { db } from './db'

export interface DailySubmission {
  id: string
  userId: string
  userName: string
  userLocale: string | null
  date: string               // YYYY-MM-DD
  locale: string
  productionHours: number
  hasNonProduction: boolean
  totalNonProductionHours: number
  npHours2pass: number
  npHoursPhi: number
  npHoursIAA: number         // IAA hours (new)
  npHoursTraining: number
  npHoursReview: number
  npHoursWaiting: number     // Waiting for worksets (new)
  npHoursMeetings: number    // Meetings (new)
  npHoursIT: number          // IT/NEAT issues (new)
  npHoursOther: number       // Legacy — kept for backward compat; new submissions send 0
  otherWorkingRemarks: string // Remarks specific to other-working hours (new)
  totalWorkingHours: number  // productionHours + totalNonProductionHours
  remarks: string
  miscCost: number | null
  invoiceUrls: string[]
  submittedAt: string
  updatedAt: string
}

/*
  SQL migration — run once in Supabase SQL editor to add the new columns:

  ALTER TABLE daily_submissions
    ADD COLUMN IF NOT EXISTS np_hours_iaa        NUMERIC(5,1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS np_hours_waiting    NUMERIC(5,1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS np_hours_meetings   NUMERIC(5,1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS np_hours_it         NUMERIC(5,1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS other_working_remarks TEXT NOT NULL DEFAULT '';
*/

// Map snake_case DB row → camelCase DailySubmission
export function toSubmission(row: Record<string, unknown>): DailySubmission {
  return {
    id:                      row.id as string,
    userId:                  row.user_id as string,
    userName:                row.user_name as string,
    userLocale:              (row.user_locale as string | null) ?? null,
    date:                    row.date as string,
    locale:                  row.locale as string,
    productionHours:         row.production_hours as number,
    hasNonProduction:        row.has_non_production as boolean,
    totalNonProductionHours: row.total_non_production_hours as number,
    npHours2pass:            (row.np_hours_2pass   as number) ?? 0,
    npHoursPhi:              (row.np_hours_phi     as number) ?? 0,
    npHoursIAA:              (row.np_hours_iaa     as number) ?? 0,
    npHoursTraining:         (row.np_hours_training as number) ?? 0,
    npHoursReview:           (row.np_hours_review  as number) ?? 0,
    npHoursWaiting:          (row.np_hours_waiting  as number) ?? 0,
    npHoursMeetings:         (row.np_hours_meetings as number) ?? 0,
    npHoursIT:               (row.np_hours_it      as number) ?? 0,
    npHoursOther:            (row.np_hours_other   as number) ?? 0,
    otherWorkingRemarks:     (row.other_working_remarks as string) ?? '',
    totalWorkingHours:       row.total_working_hours as number,
    remarks:                 (row.remarks as string) ?? '',
    miscCost:                (row.misc_cost as number | null) ?? null,
    invoiceUrls:             (row.invoice_urls as string[]) ?? [],
    submittedAt:             row.submitted_at as string,
    updatedAt:               row.updated_at as string,
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export async function readDailySubmissions(): Promise<DailySubmission[]> {
  const { data, error } = await db
    .from('daily_submissions')
    .select('*')
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(`readDailySubmissions: ${error.message}`)
  return (data ?? []).map(toSubmission)
}

export async function readDailySubmissionsByRange(
  from: string,
  to: string
): Promise<DailySubmission[]> {
  const { data, error } = await db
    .from('daily_submissions')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(`readDailySubmissionsByRange: ${error.message}`)
  return (data ?? []).map(toSubmission)
}

export async function addDailySubmission(
  sub: Omit<DailySubmission, 'id' | 'submittedAt' | 'updatedAt'>
): Promise<DailySubmission> {
  const now = new Date().toISOString()
  const row = {
    id:                        generateId(),
    user_id:                   sub.userId,
    user_name:                 sub.userName,
    user_locale:               sub.userLocale,
    date:                      sub.date,
    locale:                    sub.locale,
    production_hours:          sub.productionHours,
    has_non_production:        sub.hasNonProduction,
    total_non_production_hours: sub.totalNonProductionHours,
    np_hours_2pass:            sub.npHours2pass,
    np_hours_phi:              sub.npHoursPhi,
    np_hours_iaa:              sub.npHoursIAA,
    np_hours_training:         sub.npHoursTraining,
    np_hours_review:           sub.npHoursReview,
    np_hours_waiting:          sub.npHoursWaiting,
    np_hours_meetings:         sub.npHoursMeetings,
    np_hours_it:               sub.npHoursIT,
    np_hours_other:            sub.npHoursOther,
    other_working_remarks:     sub.otherWorkingRemarks,
    total_working_hours:       sub.totalWorkingHours,
    remarks:                   sub.remarks,
    misc_cost:                 sub.miscCost,
    invoice_urls:              sub.invoiceUrls,
    submitted_at:              now,
    updated_at:                now,
  }

  const { data, error } = await db
    .from('daily_submissions')
    .insert(row)
    .select()
    .single()

  if (error) throw new Error(`addDailySubmission: ${error.message}`)
  return toSubmission(data)
}

export async function updateDailySubmission(
  id: string,
  updates: Partial<Omit<DailySubmission, 'id' | 'submittedAt' | 'updatedAt'>>
): Promise<DailySubmission> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updates.userId                  !== undefined) row.user_id                    = updates.userId
  if (updates.userName                !== undefined) row.user_name                  = updates.userName
  if (updates.userLocale              !== undefined) row.user_locale                = updates.userLocale
  if (updates.date                    !== undefined) row.date                       = updates.date
  if (updates.locale                  !== undefined) row.locale                     = updates.locale
  if (updates.productionHours         !== undefined) row.production_hours           = updates.productionHours
  if (updates.hasNonProduction        !== undefined) row.has_non_production         = updates.hasNonProduction
  if (updates.totalNonProductionHours !== undefined) row.total_non_production_hours = updates.totalNonProductionHours
  if (updates.npHours2pass            !== undefined) row.np_hours_2pass             = updates.npHours2pass
  if (updates.npHoursPhi              !== undefined) row.np_hours_phi               = updates.npHoursPhi
  if (updates.npHoursIAA              !== undefined) row.np_hours_iaa               = updates.npHoursIAA
  if (updates.npHoursTraining         !== undefined) row.np_hours_training          = updates.npHoursTraining
  if (updates.npHoursReview           !== undefined) row.np_hours_review            = updates.npHoursReview
  if (updates.npHoursWaiting          !== undefined) row.np_hours_waiting           = updates.npHoursWaiting
  if (updates.npHoursMeetings         !== undefined) row.np_hours_meetings          = updates.npHoursMeetings
  if (updates.npHoursIT               !== undefined) row.np_hours_it                = updates.npHoursIT
  if (updates.npHoursOther            !== undefined) row.np_hours_other             = updates.npHoursOther
  if (updates.otherWorkingRemarks     !== undefined) row.other_working_remarks      = updates.otherWorkingRemarks
  if (updates.totalWorkingHours       !== undefined) row.total_working_hours        = updates.totalWorkingHours
  if (updates.remarks                 !== undefined) row.remarks                    = updates.remarks
  if (updates.miscCost                !== undefined) row.misc_cost                  = updates.miscCost
  if (updates.invoiceUrls             !== undefined) row.invoice_urls               = updates.invoiceUrls

  const { data, error } = await db
    .from('daily_submissions')
    .update(row)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateDailySubmission: ${error.message}`)
  return toSubmission(data)
}

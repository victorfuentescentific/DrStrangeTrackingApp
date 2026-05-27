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
  npHoursTraining: number
  npHoursReview: number
  npHoursOther: number
  totalWorkingHours: number  // productionHours + totalNonProductionHours
  remarks: string
  miscCost: number | null
  invoiceUrls: string[]
  submittedAt: string
  updatedAt: string
}

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
    npHours2pass:            row.np_hours_2pass as number,
    npHoursPhi:              row.np_hours_phi as number,
    npHoursTraining:         row.np_hours_training as number,
    npHoursReview:           row.np_hours_review as number,
    npHoursOther:            row.np_hours_other as number,
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
    np_hours_training:         sub.npHoursTraining,
    np_hours_review:           sub.npHoursReview,
    np_hours_other:            sub.npHoursOther,
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
  if (updates.npHoursTraining         !== undefined) row.np_hours_training          = updates.npHoursTraining
  if (updates.npHoursReview           !== undefined) row.np_hours_review            = updates.npHoursReview
  if (updates.npHoursOther            !== undefined) row.np_hours_other             = updates.npHoursOther
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

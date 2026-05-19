import 'server-only'
import { db } from './db'

export interface WorkAbroadRequest {
  id: string
  userId: string
  originCountry: string
  destinationCountry: string
  dateFrom: string   // YYYY-MM-DD
  dateTo: string     // YYYY-MM-DD
  notes: string
  submittedBy: string
  createdAt: string
  updatedAt: string
}

function toRequest(row: Record<string, unknown>): WorkAbroadRequest {
  return {
    id:                  row.id as string,
    userId:              row.user_id as string,
    originCountry:       row.origin_country as string,
    destinationCountry:  row.destination_country as string,
    dateFrom:            row.date_from as string,
    dateTo:              row.date_to as string,
    notes:               (row.notes as string) ?? '',
    submittedBy:         row.submitted_by as string,
    createdAt:           row.created_at as string,
    updatedAt:           row.updated_at as string,
  }
}

export async function getWorkAbroadByUser(userId: string): Promise<WorkAbroadRequest[]> {
  const { data, error } = await db
    .from('work_abroad_requests')
    .select('*')
    .eq('user_id', userId)
    .order('date_from', { ascending: false })

  if (error) throw new Error(`getWorkAbroadByUser: ${error.message}`)
  return (data ?? []).map(toRequest)
}

export async function getWorkAbroadRange(from: string, to: string): Promise<WorkAbroadRequest[]> {
  const { data, error } = await db
    .from('work_abroad_requests')
    .select('*')
    .lte('date_from', to)
    .gte('date_to', from)
    .order('date_from', { ascending: true })

  if (error) throw new Error(`getWorkAbroadRange: ${error.message}`)
  return (data ?? []).map(toRequest)
}

export async function createWorkAbroad(
  req: Omit<WorkAbroadRequest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<WorkAbroadRequest> {
  const row = {
    user_id:             req.userId,
    origin_country:      req.originCountry,
    destination_country: req.destinationCountry,
    date_from:           req.dateFrom,
    date_to:             req.dateTo,
    notes:               req.notes ?? '',
    submitted_by:        req.submittedBy,
  }

  const { data, error } = await db
    .from('work_abroad_requests')
    .insert(row)
    .select()
    .single()

  if (error) throw new Error(`createWorkAbroad: ${error.message}`)
  return toRequest(data)
}

export async function updateWorkAbroad(
  id: string,
  updates: Partial<Omit<WorkAbroadRequest, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<WorkAbroadRequest> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.originCountry)      row.origin_country      = updates.originCountry
  if (updates.destinationCountry) row.destination_country = updates.destinationCountry
  if (updates.dateFrom)           row.date_from           = updates.dateFrom
  if (updates.dateTo)             row.date_to             = updates.dateTo
  if (updates.notes !== undefined) row.notes              = updates.notes

  const { data, error } = await db
    .from('work_abroad_requests')
    .update(row)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateWorkAbroad: ${error.message}`)
  return toRequest(data)
}

export async function deleteWorkAbroad(id: string): Promise<void> {
  const { error } = await db
    .from('work_abroad_requests')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`deleteWorkAbroad: ${error.message}`)
}

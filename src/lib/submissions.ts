import 'server-only'
import { db } from './db'

export interface Submission {
  id: string
  userId: string
  userName: string
  userLocale: string | null
  date: string               // YYYY-MM-DD
  locale: string
  workflow: 'DAX' | 'DMO' | 'Scribing'
  phase: '1P+IAA' | '2P' | 'PHI' | 'Review'
  worksetId: string | null
  worksetName: string | null
  hours: number
  notes: string
  submittedAt: string        // ISO timestamp
}

// Map snake_case DB row → camelCase Submission
function toSubmission(row: Record<string, unknown>): Submission {
  return {
    id:           row.id as string,
    userId:       row.user_id as string,
    userName:     row.user_name as string,
    userLocale:   (row.user_locale as string | null) ?? null,
    date:         row.date as string,
    locale:       row.locale as string,
    workflow:     row.workflow as Submission['workflow'],
    phase:        row.phase as Submission['phase'],
    worksetId:    (row.workset_id as string | null) ?? null,
    worksetName:  (row.workset_name as string | null) ?? null,
    hours:        row.hours as number,
    notes:        (row.notes as string) ?? '',
    submittedAt:  row.submitted_at as string,
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export async function readSubmissions(): Promise<Submission[]> {
  const { data, error } = await db
    .from('submissions')
    .select('*')
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(`readSubmissions: ${error.message}`)
  return (data ?? []).map(toSubmission)
}

export async function addSubmission(
  sub: Omit<Submission, 'id' | 'submittedAt'>
): Promise<Submission> {
  const row = {
    id:           generateId(),
    user_id:      sub.userId,
    user_name:    sub.userName,
    user_locale:  sub.userLocale,
    date:         sub.date,
    locale:       sub.locale,
    workflow:     sub.workflow,
    phase:        sub.phase,
    workset_id:   sub.worksetId,
    workset_name: sub.worksetName,
    hours:        sub.hours,
    notes:        sub.notes,
    submitted_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from('submissions')
    .insert(row)
    .select()
    .single()

  if (error) throw new Error(`addSubmission: ${error.message}`)
  return toSubmission(data)
}

export async function getSubmissionsByUser(userId: string): Promise<Submission[]> {
  const { data, error } = await db
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(`getSubmissionsByUser: ${error.message}`)
  return (data ?? []).map(toSubmission)
}

export async function getSubmissionsByDate(date: string): Promise<Submission[]> {
  const { data, error } = await db
    .from('submissions')
    .select('*')
    .eq('date', date)

  if (error) throw new Error(`getSubmissionsByDate: ${error.message}`)
  return (data ?? []).map(toSubmission)
}

export async function getSubmissionsByDateRange(from: string, to: string): Promise<Submission[]> {
  const { data, error } = await db
    .from('submissions')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })

  if (error) throw new Error(`getSubmissionsByDateRange: ${error.message}`)
  return (data ?? []).map(toSubmission)
}

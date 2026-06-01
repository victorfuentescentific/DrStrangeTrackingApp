import 'server-only'
import { db } from './db'

/*
  SQL — run once in Supabase SQL editor:

  CREATE TABLE IF NOT EXISTS eod_submissions (
    id                  TEXT          PRIMARY KEY,
    user_id             TEXT          NOT NULL,
    user_name           TEXT          NOT NULL,
    user_locale         TEXT,
    date                DATE          NOT NULL,
    locale              TEXT          NOT NULL,
    workflow            TEXT          NOT NULL,
    workset             TEXT          NOT NULL,
    num_reports         INTEGER       NOT NULL DEFAULT 0,
    minutes_completed   NUMERIC(10,1) NOT NULL DEFAULT 0,
    minutes_transcribed NUMERIC(10,1) NOT NULL DEFAULT 0,
    ow_review_rework    NUMERIC(5,1)  NOT NULL DEFAULT 0,
    ow_it_training      NUMERIC(5,1)  NOT NULL DEFAULT 0,
    ow_neat             NUMERIC(5,1)  NOT NULL DEFAULT 0,
    ow_waiting          NUMERIC(5,1)  NOT NULL DEFAULT 0,
    ph_transcribing     NUMERIC(5,1)  NOT NULL DEFAULT 0,
    ph_iaa              NUMERIC(5,1)  NOT NULL DEFAULT 0,
    ph_phi              NUMERIC(5,1)  NOT NULL DEFAULT 0,
    remarks             TEXT          NOT NULL DEFAULT '',
    submitted_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, date)
  );
*/

export interface EodSubmission {
  id:                string
  userId:            string
  userName:          string
  userLocale:        string | null
  date:              string          // YYYY-MM-DD
  locale:            string
  workflow:          string          // DAX | DMO | Scribing
  workset:           string
  // Production metrics
  numReports:        number
  minutesCompleted:  number
  minutesTranscribed: number
  // Other Working Hours
  owReviewRework:    number          // PHI Review, 2Pass Review, end-of-workset review
  owItTraining:      number          // IT issues (non-NEAT) + training
  owNeat:            number          // NEAT issues + NEAT testing
  owWaiting:         number          // Waiting for a workset
  // Production Hours
  phTranscribing:    number          // Transcribing + Scribing production
  phIaa:             number          // IAA
  phPhi:             number          // PHI production
  remarks:           string
  submittedAt:       string
  updatedAt:         string
}

export function toEodSubmission(row: Record<string, unknown>): EodSubmission {
  return {
    id:                  row.id                   as string,
    userId:              row.user_id              as string,
    userName:            row.user_name            as string,
    userLocale:          (row.user_locale         as string | null) ?? null,
    date:                row.date                 as string,
    locale:              row.locale               as string,
    workflow:            row.workflow             as string,
    workset:             row.workset              as string,
    numReports:          (row.num_reports         as number) ?? 0,
    minutesCompleted:    (row.minutes_completed   as number) ?? 0,
    minutesTranscribed:  (row.minutes_transcribed as number) ?? 0,
    owReviewRework:      (row.ow_review_rework    as number) ?? 0,
    owItTraining:        (row.ow_it_training      as number) ?? 0,
    owNeat:              (row.ow_neat             as number) ?? 0,
    owWaiting:           (row.ow_waiting          as number) ?? 0,
    phTranscribing:      (row.ph_transcribing     as number) ?? 0,
    phIaa:               (row.ph_iaa              as number) ?? 0,
    phPhi:               (row.ph_phi              as number) ?? 0,
    remarks:             (row.remarks             as string) ?? '',
    submittedAt:         row.submitted_at         as string,
    updatedAt:           row.updated_at           as string,
  }
}

function generateId(): string {
  return 'eod_' + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function readEodSubmissions(): Promise<EodSubmission[]> {
  const { data, error } = await db
    .from('eod_submissions')
    .select('*')
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(`readEodSubmissions: ${error.message}`)
  return (data ?? []).map(toEodSubmission)
}

export async function readEodByDate(date: string): Promise<EodSubmission[]> {
  const { data, error } = await db
    .from('eod_submissions')
    .select('*')
    .eq('date', date)
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(`readEodByDate: ${error.message}`)
  return (data ?? []).map(toEodSubmission)
}

export async function readEodByUserAndDate(
  userId: string,
  date: string,
): Promise<EodSubmission | null> {
  const { data, error } = await db
    .from('eod_submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()
  if (error) throw new Error(`readEodByUserAndDate: ${error.message}`)
  return data ? toEodSubmission(data) : null
}

export async function readEodByLocaleAndDate(
  locale: string,
  date: string,
): Promise<EodSubmission[]> {
  const { data, error } = await db
    .from('eod_submissions')
    .select('*')
    .eq('locale', locale)
    .eq('date', date)
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(`readEodByLocaleAndDate: ${error.message}`)
  return (data ?? []).map(toEodSubmission)
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function addEodSubmission(
  sub: Omit<EodSubmission, 'id' | 'submittedAt' | 'updatedAt'>,
): Promise<EodSubmission> {
  const now = new Date().toISOString()
  const row = {
    id:                  generateId(),
    user_id:             sub.userId,
    user_name:           sub.userName,
    user_locale:         sub.userLocale,
    date:                sub.date,
    locale:              sub.locale,
    workflow:            sub.workflow,
    workset:             sub.workset,
    num_reports:         sub.numReports,
    minutes_completed:   sub.minutesCompleted,
    minutes_transcribed: sub.minutesTranscribed,
    ow_review_rework:    sub.owReviewRework,
    ow_it_training:      sub.owItTraining,
    ow_neat:             sub.owNeat,
    ow_waiting:          sub.owWaiting,
    ph_transcribing:     sub.phTranscribing,
    ph_iaa:              sub.phIaa,
    ph_phi:              sub.phPhi,
    remarks:             sub.remarks,
    submitted_at:        now,
    updated_at:          now,
  }
  const { data, error } = await db.from('eod_submissions').insert(row).select().single()
  if (error) throw new Error(`addEodSubmission: ${error.message}`)
  return toEodSubmission(data)
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateEodSubmission(
  id: string,
  updates: Partial<Omit<EodSubmission, 'id' | 'submittedAt' | 'updatedAt'>>,
): Promise<EodSubmission> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.locale             !== undefined) row.locale              = updates.locale
  if (updates.workflow           !== undefined) row.workflow            = updates.workflow
  if (updates.workset            !== undefined) row.workset             = updates.workset
  if (updates.numReports         !== undefined) row.num_reports         = updates.numReports
  if (updates.minutesCompleted   !== undefined) row.minutes_completed   = updates.minutesCompleted
  if (updates.minutesTranscribed !== undefined) row.minutes_transcribed = updates.minutesTranscribed
  if (updates.owReviewRework     !== undefined) row.ow_review_rework    = updates.owReviewRework
  if (updates.owItTraining       !== undefined) row.ow_it_training      = updates.owItTraining
  if (updates.owNeat             !== undefined) row.ow_neat             = updates.owNeat
  if (updates.owWaiting          !== undefined) row.ow_waiting          = updates.owWaiting
  if (updates.phTranscribing     !== undefined) row.ph_transcribing     = updates.phTranscribing
  if (updates.phIaa              !== undefined) row.ph_iaa              = updates.phIaa
  if (updates.phPhi              !== undefined) row.ph_phi              = updates.phPhi
  if (updates.remarks            !== undefined) row.remarks             = updates.remarks

  const { data, error } = await db
    .from('eod_submissions')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`updateEodSubmission: ${error.message}`)
  return toEodSubmission(data)
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteEodSubmission(id: string): Promise<void> {
  const { error } = await db.from('eod_submissions').delete().eq('id', id)
  if (error) throw new Error(`deleteEodSubmission: ${error.message}`)
}

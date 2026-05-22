import 'server-only'
import bcrypt from 'bcryptjs'
import { db } from './db'

export interface StoredUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'lead' | 'fte' | 'freelancer'
  locale: string | null
  employeeType: string | null
  workflow: string | null
  passwordHash: string
}

// accounts_credentials is now the single source of truth for all user data.
// Auth reads centific_email and password_hash from that table.

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const { data, error } = await db
    .from('accounts_credentials')
    .select('id, name, centific_email, role, locale, resource_type, workflow, password_hash')
    .ilike('centific_email', email)
    .maybeSingle()

  if (error || !data || !data.password_hash) return undefined

  return {
    id:           data.id,
    name:         data.name,
    email:        data.centific_email,
    role:         data.role as 'admin' | 'lead' | 'fte' | 'freelancer',
    locale:       data.locale ?? null,
    employeeType: data.resource_type ?? null,
    workflow:     data.workflow ?? null,
    passwordHash: data.password_hash,
  }
}

export async function validatePassword(user: StoredUser, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash)
}

export async function updatePassword(id: string, newPassword: string): Promise<boolean> {
  const hash = await bcrypt.hash(newPassword, 10)
  const { error } = await db
    .from('accounts_credentials')
    .update({ password_hash: hash, updated_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}

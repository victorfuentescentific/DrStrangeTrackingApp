import 'server-only'
import bcrypt from 'bcryptjs'
import { db } from './db'

export interface StoredUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'freelancer'
  locale: string | null
  passwordHash: string
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const { data, error } = await db
    .from('users')
    .select('id, name, email, role, locale, password_hash')
    .ilike('email', email)
    .maybeSingle()

  if (error || !data) return undefined

  return {
    id:           data.id,
    name:         data.name,
    email:        data.email,
    role:         data.role as 'admin' | 'freelancer',
    locale:       data.locale ?? null,
    passwordHash: data.password_hash,
  }
}

export async function validatePassword(user: StoredUser, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash)
}

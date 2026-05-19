import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'dev-secret-change-in-production'
)
const COOKIE = 'wpm-session'
const TTL = 60 * 60 * 8 // 8 hours

export interface SessionUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'fte' | 'freelancer'
  locale: string | null
  employeeType: string | null
  workflow: string | null
}

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return {
      id:           payload.id as string,
      name:         payload.name as string,
      email:        payload.email as string,
      role:         payload.role as 'admin' | 'fte' | 'freelancer',
      locale:       (payload.locale as string | null) ?? null,
      employeeType: (payload.employeeType as string | null) ?? null,
      workflow:     (payload.workflow as string | null) ?? null,
    }
  } catch {
    return null
  }
}

export function getSessionCookie(value: string, maxAge: number): string {
  return `${COOKIE}=${value}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`
}

export { COOKIE }

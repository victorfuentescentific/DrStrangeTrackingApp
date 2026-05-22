/**
 * Simple in-memory rate limiter — suitable for internal tools on a single server.
 * Resets on cold start (acceptable at this scale).
 *
 * Usage:
 *   const limiter = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 })
 *   const result  = limiter.check(ip)
 *   if (!result.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
 */

interface Entry {
  count:    number
  resetAt:  number  // epoch ms when the window expires
}

export interface RateLimitResult {
  allowed:    boolean
  remaining:  number
  resetAt:    number  // epoch ms
}

export interface RateLimiterOptions {
  max:       number  // max requests per window
  windowMs:  number  // window duration in ms
}

export function createRateLimiter({ max, windowMs }: RateLimiterOptions) {
  const store = new Map<string, Entry>()

  // Periodic cleanup so the map doesn't grow unbounded
  const cleanup = () => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key)
    }
  }
  setInterval(cleanup, windowMs)

  return {
    check(key: string): RateLimitResult {
      const now = Date.now()
      let entry = store.get(key)

      if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + windowMs }
        store.set(key, entry)
      }

      entry.count++

      return {
        allowed:   entry.count <= max,
        remaining: Math.max(0, max - entry.count),
        resetAt:   entry.resetAt,
      }
    },

    reset(key: string) {
      store.delete(key)
    },
  }
}

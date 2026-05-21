'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok || !data.ok) {
      setError(data.error ?? 'Login failed')
      return
    }

    // Hard navigation ensures the new session cookie is sent with the
    // first middleware-protected request (client-side router.push can
    // race with cookie propagation in Next.js App Router).
    const dest = data.user?.role === 'freelancer' ? '/submit' : '/'
    window.location.href = dest
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0612] text-white">
      {/* ──────────────── Background gradient orb ──────────────── */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0612] via-[#1a0f3a] to-[#0a0612]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-purple-700/20 blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      {/* ──────────────── Sacred geometry seal ──────────────── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
        <SacredSeal />
      </div>

      {/* ──────────────── Floating particles ──────────────── */}
      <Particles />

      {/* ──────────────── Login card ──────────────── */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400/30 to-purple-600/30 border border-amber-300/40 backdrop-blur-sm mb-3 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
              <RuneGlyph className="w-6 h-6 text-amber-200" />
            </div>
            <h1 className="text-2xl font-bold tracking-wider text-amber-100 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
              Dr. Strange Portal
            </h1>
            <p className="text-xs uppercase tracking-[0.3em] text-purple-200/60 mt-1">
              EU LLM Data — Operations Suite
            </p>
          </div>

          {/* Frosted card */}
          <div className="relative p-8 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-amber-200/20 shadow-[0_0_60px_rgba(124,58,237,0.15)]">
            {/* Gold corner accents */}
            <CornerAccent className="absolute top-2 left-2 w-4 h-4 text-amber-300/60" />
            <CornerAccent className="absolute top-2 right-2 w-4 h-4 text-amber-300/60 rotate-90" />
            <CornerAccent className="absolute bottom-2 left-2 w-4 h-4 text-amber-300/60 -rotate-90" />
            <CornerAccent className="absolute bottom-2 right-2 w-4 h-4 text-amber-300/60 rotate-180" />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-amber-200/80 mb-1.5" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-purple-300/20 rounded-lg text-white placeholder:text-purple-200/30 focus:outline-none focus:border-amber-300/60 focus:ring-1 focus:ring-amber-300/40 transition-colors"
                  placeholder="you@centific.com"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-amber-200/80 mb-1.5" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-purple-300/20 rounded-lg text-white placeholder:text-purple-200/30 focus:outline-none focus:border-amber-300/60 focus:ring-1 focus:ring-amber-300/40 transition-colors"
                />
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-900/30 border border-red-400/30">
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#1a0f3a] font-bold tracking-wider uppercase text-sm rounded-lg transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]"
              >
                {loading ? 'Opening portal…' : 'Enter'}
              </button>
            </form>
          </div>

          {/* Footer line */}
          <p className="text-[10px] uppercase tracking-[0.3em] text-purple-300/40 text-center mt-6">
            Centific · EU LLM Data Operations
          </p>
        </div>
      </div>

      {/* Local CSS for rotation animations */}
      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to   { transform: rotate(0deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 0.8; }
        }
        @keyframes drift {
          0%, 100% { transform: translate(0, 0); opacity: 0.3; }
          50%      { transform: translate(20px, -30px); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sacred geometry seal — three concentric SVG rings rotating at different
// speeds. Hand-drawn, inspired by sacred-circle iconography (no Marvel art).
// ─────────────────────────────────────────────────────────────────────────────
function SacredSeal() {
  return (
    <svg
      width="680"
      height="680"
      viewBox="0 0 680 680"
      fill="none"
      className="opacity-40"
      style={{ filter: 'drop-shadow(0 0 30px rgba(245, 158, 11, 0.25))' }}
    >
      {/* Outer ring — runic notches */}
      <g style={{ animation: 'spin-slow 80s linear infinite', transformOrigin: '340px 340px' }}>
        <circle cx="340" cy="340" r="320" stroke="#FCD34D" strokeWidth="1" strokeDasharray="2 8" opacity="0.5" />
        <circle cx="340" cy="340" r="310" stroke="#FCD34D" strokeWidth="0.5" opacity="0.4" />
        {/* Notch glyphs every 30° */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180
          const x1 = 340 + Math.cos(angle) * 305
          const y1 = 340 + Math.sin(angle) * 305
          const x2 = 340 + Math.cos(angle) * 325
          const y2 = 340 + Math.sin(angle) * 325
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FCD34D" strokeWidth="1.5" opacity="0.6" />
        })}
      </g>

      {/* Middle ring — geometric pattern */}
      <g style={{ animation: 'spin-reverse 60s linear infinite', transformOrigin: '340px 340px' }}>
        <circle cx="340" cy="340" r="240" stroke="#A78BFA" strokeWidth="0.5" opacity="0.5" />
        <circle cx="340" cy="340" r="225" stroke="#A78BFA" strokeWidth="0.5" opacity="0.4" />
        {/* Star polygon */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * 45 * Math.PI) / 180
          const x = 340 + Math.cos(a) * 235
          const y = 340 + Math.sin(a) * 235
          return <circle key={i} cx={x} cy={y} r="3" fill="#FCD34D" opacity="0.7" />
        })}
        {/* Connecting lines forming a star */}
        <polygon
          points={Array.from({ length: 8 }).map((_, i) => {
            const a = (i * 45 * Math.PI) / 180
            return `${340 + Math.cos(a) * 235},${340 + Math.sin(a) * 235}`
          }).join(' ')}
          stroke="#A78BFA"
          strokeWidth="0.5"
          fill="none"
          opacity="0.4"
        />
      </g>

      {/* Inner ring — fine detail */}
      <g style={{ animation: 'spin-slow 40s linear infinite', transformOrigin: '340px 340px' }}>
        <circle cx="340" cy="340" r="160" stroke="#FCD34D" strokeWidth="0.5" strokeDasharray="1 4" opacity="0.5" />
        <circle cx="340" cy="340" r="150" stroke="#FCD34D" strokeWidth="0.5" opacity="0.5" />
        {/* Inner sextagram */}
        <polygon
          points={Array.from({ length: 6 }).map((_, i) => {
            const a = (i * 60 * Math.PI) / 180 - Math.PI / 2
            return `${340 + Math.cos(a) * 145},${340 + Math.sin(a) * 145}`
          }).join(' ')}
          stroke="#FCD34D"
          strokeWidth="0.8"
          fill="none"
          opacity="0.6"
        />
        <polygon
          points={Array.from({ length: 6 }).map((_, i) => {
            const a = (i * 60 * Math.PI) / 180 + Math.PI / 2
            return `${340 + Math.cos(a) * 145},${340 + Math.sin(a) * 145}`
          }).join(' ')}
          stroke="#FCD34D"
          strokeWidth="0.8"
          fill="none"
          opacity="0.6"
        />
      </g>

      {/* Center — pulse */}
      <g style={{ animation: 'pulse-glow 3s ease-in-out infinite' }}>
        <circle cx="340" cy="340" r="60" stroke="#FCD34D" strokeWidth="1" opacity="0.6" />
        <circle cx="340" cy="340" r="40" stroke="#FCD34D" strokeWidth="0.5" opacity="0.5" />
        <circle cx="340" cy="340" r="20" fill="#FCD34D" opacity="0.3" />
        <circle cx="340" cy="340" r="6"  fill="#FCD34D" opacity="0.9" />
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating particles — small dots scattered across the page, gently drifting.
// ─────────────────────────────────────────────────────────────────────────────
function Particles() {
  // Static seeded positions so it's deterministic
  const particles = [
    { left: '10%',  top: '15%', size: 2, delay: '0s',   duration: '8s' },
    { left: '85%',  top: '20%', size: 3, delay: '1s',   duration: '12s' },
    { left: '25%',  top: '80%', size: 2, delay: '2s',   duration: '10s' },
    { left: '70%',  top: '85%', size: 4, delay: '0.5s', duration: '14s' },
    { left: '50%',  top: '10%', size: 2, delay: '3s',   duration: '11s' },
    { left: '15%',  top: '50%', size: 3, delay: '1.5s', duration: '9s' },
    { left: '90%',  top: '60%', size: 2, delay: '2.5s', duration: '13s' },
    { left: '60%',  top: '30%', size: 2, delay: '0.8s', duration: '10s' },
    { left: '35%',  top: '40%', size: 3, delay: '1.2s', duration: '12s' },
    { left: '80%',  top: '45%', size: 2, delay: '2.2s', duration: '11s' },
    { left: '20%',  top: '25%', size: 2, delay: '3.5s', duration: '14s' },
    { left: '75%',  top: '70%', size: 3, delay: '1.8s', duration: '9s' },
  ]
  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-amber-200"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animation: `drift ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
            filter: 'blur(0.5px)',
            boxShadow: '0 0 6px rgba(252, 211, 77, 0.6)',
          }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand glyph — abstract eye/seal in the top circle.
// ─────────────────────────────────────────────────────────────────────────────
function RuneGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6"  />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small L-shaped accent for card corners.
// ─────────────────────────────────────────────────────────────────────────────
function CornerAccent({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M 2 8 L 2 2 L 8 2" strokeLinecap="round" />
    </svg>
  )
}

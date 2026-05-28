import type { CSSProperties } from 'react'

// ─── Locale color palette ────────────────────────────────────────────────────
// Explicit map for known locales; unknown locales get a deterministic hash colour.

export const LOCALE_COLOR_MAP: Record<string, string> = {
  en_GB: '#3b82f6',  // blue-500
  de_DE: '#ef4444',  // red-500
  nl_NL: '#f97316',  // orange-500
  fr_FR: '#8b5cf6',  // violet-500
  da_DK: '#06b6d4',  // cyan-500
  nb_NO: '#ec4899',  // pink-500
  fi_FI: '#84cc16',  // lime-500
  es_ES: '#f59e0b',  // amber-500
  it_IT: '#10b981',  // emerald-500
  pt_PT: '#6366f1',  // indigo-500
}

const FALLBACK_PALETTE = [
  '#14b8a6', '#a855f7', '#f43f5e', '#0ea5e9',
  '#78716c', '#d97706', '#16a34a', '#9333ea',
]

function simpleHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

export function getLocaleColor(locale: string): string {
  return LOCALE_COLOR_MAP[locale] ?? FALLBACK_PALETTE[simpleHash(locale) % FALLBACK_PALETTE.length]
}

// ─── Phase key type ──────────────────────────────────────────────────────────
export type PhaseKey = 'p1' | 'rev' | 'p2' | 'phi'

export const PHASE_LABEL: Record<PhaseKey, string> = {
  p1:  '1P+IAA',
  rev: 'REV',
  p2:  '2P',
  phi: 'PHI',
}

// ─── Phase texture patterns ──────────────────────────────────────────────────
// Applied as backgroundImage overlays on top of the locale base color.
// White semi-transparent patterns so they work on any hue.
// Each phase gets a distinct geometric pattern for print/colorblind accessibility.

export const PHASE_PATTERN_STYLE: Record<PhaseKey, CSSProperties> = {
  // 1P+IAA — 45° diagonal stripes
  p1: {
    backgroundImage:
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 3px, transparent 3px, transparent 10px)',
  },

  // REV — cross-hatch (horizontal + vertical grid)
  rev: {
    backgroundImage: [
      'repeating-linear-gradient(0deg,  rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 2px, transparent 2px, transparent 8px)',
      'repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 2px, transparent 2px, transparent 8px)',
    ].join(', '),
  },

  // 2P — dot grid
  p2: {
    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.35) 1.5px, transparent 1.5px)',
    backgroundSize:  '8px 8px',
  },

  // PHI — solid (no overlay pattern; cleanest of the four)
  phi: {},
}

// ─── Phase legend entries ────────────────────────────────────────────────────
export const PHASE_LEGEND: Array<{ key: PhaseKey; label: string; description: string }> = [
  { key: 'p1',  label: '1P+IAA', description: '45° diagonal stripes' },
  { key: 'rev', label: 'REV',    description: 'Cross-hatch'          },
  { key: 'p2',  label: '2P',     description: 'Dot grid'             },
  { key: 'phi', label: 'PHI',    description: 'Solid'                },
]

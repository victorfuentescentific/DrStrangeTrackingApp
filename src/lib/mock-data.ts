import { User, Workset } from './types'

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Admin User',  email: 'admin@company.com',  role: 'admin',  team: 'Platform', initials: 'AU' },
  { id: 'u2', name: 'PM User 1',   email: 'pm1@company.com',    role: 'pm',     team: 'EU LLM',   initials: 'P1' },
  { id: 'u3', name: 'PM User 2',   email: 'pm2@company.com',    role: 'pm',     team: 'EU LLM',   initials: 'P2' },
  { id: 'u4', name: 'Lead User',   email: 'lead@company.com',   role: 'lead',   team: 'EU LLM',   initials: 'LU' },
  { id: 'u5', name: 'Viewer User', email: 'viewer@company.com', role: 'viewer', team: 'EU LLM',   initials: 'VU' },
]

// ─── Locale list grouped by region ───────────────────────────────────────────
export const LOCALES_BY_REGION = {
  EU: {
    'Tier 1 (VV-Agent model)': [
      { code: 'en_GB', label: 'English (UK)',  tier: 1 },
      { code: 'de_DE', label: 'German (DE)',   tier: 1 },
      { code: 'nl_NL', label: 'Dutch (NL)',    tier: 1 },
      { code: 'fr_FR', label: 'French (FR)',   tier: 1 },
    ],
    'Nordic / Tier 2': [
      { code: 'da_DK', label: 'Danish (DK)',    tier: 2 },
      { code: 'nb_NO', label: 'Norwegian (NO)', tier: 2 },
      { code: 'fi_FI', label: 'Finnish (FI)',   tier: 2 },
      { code: 'sv_SE', label: 'Swedish (SE)',   tier: 2 },
    ],
    'EU Other': [
      { code: 'es_ES', label: 'Spanish (ES)',   tier: 0 },
      { code: 'it_IT', label: 'Italian (IT)',   tier: 0 },
      { code: 'pt_PT', label: 'Portuguese (PT)',tier: 0 },
      { code: 'pl_PL', label: 'Polish (PL)',    tier: 0 },
      { code: 'cs_CZ', label: 'Czech (CZ)',     tier: 0 },
      { code: 'hu_HU', label: 'Hungarian (HU)', tier: 0 },
      { code: 'ro_RO', label: 'Romanian (RO)',  tier: 0 },
      { code: 'tr_TR', label: 'Turkish (TR)',   tier: 0 },
    ],
  },
  US: {
    'Americas': [
      { code: 'en_US', label: 'English (US)',        tier: 0 },
      { code: 'es_US', label: 'Spanish (US)',        tier: 0 },
      { code: 'pt_BR', label: 'Portuguese (BR)',     tier: 0 },
      { code: 'es_MX', label: 'Spanish (MX)',        tier: 0 },
      { code: 'fr_CA', label: 'French (CA)',         tier: 0 },
    ],
  },
  IN: {
    'Indian Languages': [
      { code: 'hi_IN', label: 'Hindi (IN)',      tier: 0 },
      { code: 'ta_IN', label: 'Tamil (IN)',      tier: 0 },
      { code: 'te_IN', label: 'Telugu (IN)',     tier: 0 },
      { code: 'bn_IN', label: 'Bengali (IN)',    tier: 0 },
      { code: 'mr_IN', label: 'Marathi (IN)',    tier: 0 },
      { code: 'gu_IN', label: 'Gujarati (IN)',   tier: 0 },
      { code: 'kn_IN', label: 'Kannada (IN)',    tier: 0 },
      { code: 'ml_IN', label: 'Malayalam (IN)',  tier: 0 },
      { code: 'pa_IN', label: 'Punjabi (IN)',    tier: 0 },
      { code: 'ur_IN', label: 'Urdu (IN)',       tier: 0 },
    ],
    'APAC': [
      { code: 'ja_JP', label: 'Japanese (JP)',   tier: 0 },
      { code: 'ko_KR', label: 'Korean (KR)',     tier: 0 },
      { code: 'zh_CN', label: 'Chinese Simp. (CN)', tier: 0 },
      { code: 'zh_TW', label: 'Chinese Trad. (TW)', tier: 0 },
      { code: 'th_TH', label: 'Thai (TH)',       tier: 0 },
      { code: 'id_ID', label: 'Indonesian (ID)', tier: 0 },
      { code: 'ms_MY', label: 'Malay (MY)',      tier: 0 },
      { code: 'vi_VN', label: 'Vietnamese (VN)', tier: 0 },
      { code: 'ar_SA', label: 'Arabic (SA)',     tier: 0 },
    ],
  },
}

// Flat locale list for lookups
export const ALL_LOCALES = Object.values(LOCALES_BY_REGION)
  .flatMap(groups => Object.values(groups))
  .flat()

export function getLocaleLabel(code: string): string {
  return ALL_LOCALES.find(l => l.code === code)?.label ?? code
}

export const MOCK_WORKSETS: Workset[] = []

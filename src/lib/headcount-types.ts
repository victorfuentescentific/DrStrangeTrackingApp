// Headcount tracker types — sourced from "Main Tracker Dr.Strange Tier 1"
// PII-bearing record; access restricted to admin + lead roles via API.

export type HeadcountStatus = 'Active' | 'Inactive' | 'Offboarded'
export type HeadcountResourceType = 'FTE' | 'Freelancer' | 'Management'

export interface HeadcountRecord {
  id: string
  name: string
  locale: string | null
  role: string | null
  workflow: string | null
  resourceType: string | null
  onboardingStatus: string | null
  idCheckDate: string | null
  startDate: string | null
  personalEmail: string | null
  centificEmail: string | null
  shippingAddress: string | null
  phoneNumber: string | null
  phoneVersion: string | null
  laptopType: string | null
  oneFormaId: string | null
  empId: string | null
  vMicrosoftEmail: string | null
  msId: string | null
  status: string | null
  inactiveDate: string | null
  remarks: string | null
}

export interface HeadcountAnalytics {
  total: number
  active: number
  inactive: number
  offboarded: number
  byLocale: Record<string, { active: number; inactive: number; offboarded: number; total: number }>
  byWorkflow: Record<string, { active: number; inactive: number; offboarded: number; total: number }>
  byResourceType: Record<string, { active: number; inactive: number; offboarded: number; total: number }>
  byRole: Record<string, { active: number; inactive: number; offboarded: number; total: number }>
}

export const ALL_HC_COLUMNS: { key: keyof HeadcountRecord; label: string; width?: string }[] = [
  { key: 'name',             label: 'Name',             width: 'w-44' },
  { key: 'locale',           label: 'Locale',           width: 'w-20' },
  { key: 'role',             label: 'Role',             width: 'w-28' },
  { key: 'workflow',         label: 'Workflow',         width: 'w-28' },
  { key: 'resourceType',     label: 'Resource Type',    width: 'w-28' },
  { key: 'status',           label: 'Status',           width: 'w-24' },
  { key: 'onboardingStatus', label: 'Onboarding',       width: 'w-28' },
  { key: 'startDate',        label: 'Start Date',       width: 'w-28' },
  { key: 'idCheckDate',      label: 'ID Check Date',    width: 'w-28' },
  { key: 'centificEmail',    label: 'Centific Email',   width: 'w-56' },
  { key: 'personalEmail',    label: 'Personal Email',   width: 'w-56' },
  { key: 'vMicrosoftEmail',  label: 'MS Email',         width: 'w-56' },
  { key: 'msId',             label: 'MS ID',            width: 'w-24' },
  { key: 'empId',            label: 'Emp ID',           width: 'w-24' },
  { key: 'oneFormaId',       label: 'OneForma ID',      width: 'w-24' },
  { key: 'phoneNumber',      label: 'Phone',            width: 'w-32' },
  { key: 'phoneVersion',     label: 'Phone Version',    width: 'w-32' },
  { key: 'laptopType',       label: 'Laptop Type',      width: 'w-32' },
  { key: 'shippingAddress',  label: 'Shipping Address', width: 'w-64' },
  { key: 'inactiveDate',     label: 'Inactive Date',    width: 'w-28' },
  { key: 'remarks',          label: 'Remarks',          width: 'w-64' },
]

export function normalizeStatus(s: string | null | undefined): HeadcountStatus | 'Unknown' {
  if (!s) return 'Unknown'
  const v = s.trim().toLowerCase()
  if (v === 'active') return 'Active'
  if (v === 'inactive') return 'Inactive'
  if (v === 'offboarded') return 'Offboarded'
  return 'Unknown'
}

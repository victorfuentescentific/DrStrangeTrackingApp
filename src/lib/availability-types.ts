// Shared types and constants for availability — safe to import in client components

export type AvailabilityStatus =
  | 'AVAILABLE'
  | 'PTO'
  | 'BH'
  | 'NO'
  | 'SL'
  | 'WA'
  | 'UL'
  | 'DH'
  | 'PATERNITY'
  | 'OTHER'

export interface AvailabilitySubmission {
  id: string
  userId: string
  date: string
  status: AvailabilityStatus
  availabilityHours: number | null
  estimatedStartCet: string | null
  locale: string | null
  workflow: string | null
  notes: string
  submittedBy: string
  importBatchId: string | null
  flaggedForReview: boolean
  flagReason: string | null
  createdAt: string
  updatedAt: string
}

export const STATUS_CONFIG: Record<AvailabilityStatus, {
  label: string
  color: string
  ftColor?: string
}> = {
  AVAILABLE:  { label: 'Available',       color: 'bg-green-100 text-green-800' },
  PTO:        { label: 'PTO',             color: 'bg-blue-100 text-blue-800' },
  BH:         { label: 'Bank Holiday',    color: 'bg-purple-100 text-purple-800' },
  NO:         { label: 'Not Available',   color: 'bg-red-100 text-red-800',
                ftColor: 'bg-gray-100 text-gray-600' },
  SL:         { label: 'Sick Leave',      color: 'bg-orange-100 text-orange-800' },
  WA:         { label: 'Working Abroad',  color: 'bg-teal-100 text-teal-800' },
  UL:         { label: 'Unpaid Leave',    color: 'bg-yellow-100 text-yellow-800' },
  DH:         { label: 'Doctor Hours',    color: 'bg-pink-100 text-pink-800' },
  PATERNITY:  { label: 'Paternity',       color: 'bg-indigo-100 text-indigo-800' },
  OTHER:      { label: 'Other',           color: 'bg-gray-100 text-gray-600' },
}

export const FTE_ONLY_STATUSES: AvailabilityStatus[] = ['PTO', 'UL', 'DH', 'PATERNITY', 'OTHER']

export const FTE_STATUS_HOURS: Record<string, number> = {
  AVAILABLE: -1,
  WA:        8,
  NO:        8,
  PTO:       0,
  BH:        0,
  SL:        0,
  UL:        0,
  DH:        0,
  PATERNITY: 0,
  OTHER:     0,
}

export type WorksetStatus =
  | 'not-started'
  | 'in-progress'
  | 'at-risk'
  | 'blocked'
  | 'completed'
  | 'overdue'

export type WorkflowType = 'DAX' | 'DMO' | 'Scribing'
export type TeamType    = 'Transcription' | 'Scribing'
export type Region      = 'EU' | 'US' | 'IN'
export type Priority    = 'low' | 'medium' | 'high' | 'critical'
export type RiskLevel   = 'low' | 'medium' | 'high' | 'critical'
export type UserRole    = 'admin' | 'pm' | 'lead' | 'viewer'
export type NotificationType    = 'reminder' | 'escalation' | 'blocked' | 'phase' | 'update' | 'info'
export type NotificationPriority = 'low' | 'medium' | 'high'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  team: string
  initials: string
}

export interface HeadStartInfo {
  headStartBegin: string  // = predecessor's p2Start (when head start begins)
  headStartEnd:   string  // = predecessor's rev2End (when head start ends)
  headStartDone:  number  // work units completed during head start window
  headStartPct:   number  // fraction of total 1P+IAA WL completed (0–1)
  d1Rem:          number  // remaining 1P+IAA days for full team (includes +1d buffer)
}

export interface PhaseTimeline {
  p1Start:  string   // 1P+IAA combined start
  p1End:    string   // 1P+IAA combined end (IAA now embedded)
  rev1End:  string
  p2Start:  string
  p2End:    string
  rev2End:  string
  phiStart: string
  etaDate:  string
  totalDays: number
  d1:  number        // 1P+IAA combined duration (working days)
  d2:  number
  dpf: number
  model: 'Sequential' | 'Parallel'
  isTier2: boolean
  headStart?: HeadStartInfo  // present only when this workset is a successor
}

export interface AuditEntry {
  id: string
  field: string
  oldValue: string | null
  newValue: string
  changedBy: string
  changedAt: string
  reason?: string
}

export interface Workset {
  id: string
  worksetId: string
  name: string
  workflow: WorkflowType
  locale: string
  team: TeamType
  region: Region
  teamSize: number
  status: WorksetStatus
  priority: Priority
  riskLevel: RiskLevel
  startDate: string
  eta: string
  revisedEta?: string
  phases?: PhaseTimeline
  isBlocked: boolean
  blockerDescription?: string
  isEscalated: boolean
  escalationReason?: string
  notes: string
  expirationDate?: string  // hard deadline — workset must complete by this date
  completedAt?: string
  predecessorId?: string   // set when this workset is the successor of another
  createdAt: string
  updatedAt: string
  auditTrail: AuditEntry[]
}

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  worksetId?: string
  worksetName?: string
  isRead: boolean
  createdAt: string
  priority: NotificationPriority
}

export interface FilterState {
  search: string
  workflow: WorkflowType | 'all'
  region: Region | 'all'
  locale: string
  status: WorksetStatus | 'all'
  priority: Priority | 'all'
  riskLevel: RiskLevel | 'all'
  showBlockedOnly: boolean
  showEscalatedOnly: boolean
  dateFrom: string
  dateTo: string
}

export const ROLE_PERMISSIONS: Record<UserRole, {
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canEscalate: boolean
  canViewAll: boolean
}> = {
  admin:  { canCreate: true,  canEdit: true,  canDelete: true,  canEscalate: true,  canViewAll: true  },
  pm:     { canCreate: true,  canEdit: true,  canDelete: false, canEscalate: true,  canViewAll: true  },
  lead:   { canCreate: true,  canEdit: true,  canDelete: false, canEscalate: true,  canViewAll: true  },
  viewer: { canCreate: false, canEdit: false, canDelete: false, canEscalate: false, canViewAll: true  },
}

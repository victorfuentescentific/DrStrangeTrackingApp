import { clsx, type ClassValue } from 'clsx'
import { differenceInCalendarDays, format, parseISO, isValid } from 'date-fns'
import { WorksetStatus, Priority, RiskLevel, NotificationType } from './types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    if (!isValid(date)) return dateStr
    return format(date, 'dd MMM yyyy')
  } catch {
    return dateStr
  }
}

export function formatDateShort(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    if (!isValid(date)) return dateStr
    return format(date, 'MMM d')
  } catch {
    return dateStr
  }
}

export function daysUntil(dateStr: string): number {
  try {
    const date = parseISO(dateStr)
    if (!isValid(date)) return 0
    return differenceInCalendarDays(date, new Date())
  } catch {
    return 0
  }
}

export function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days}d`
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function generateWorksetId(existing: string[]): string {
  const nums = existing
    .map(id => parseInt(id.replace('WS-', ''), 10))
    .filter(n => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `WS-${String(next).padStart(3, '0')}`
}

// ─── Status ───────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<WorksetStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'at-risk':     'At Risk',
  'blocked':     'Blocked',
  'completed':   'Completed',
  'overdue':     'Overdue',
}

export const STATUS_COLORS: Record<WorksetStatus, string> = {
  'not-started': 'bg-slate-100 text-slate-700',
  'in-progress': 'bg-blue-100 text-blue-700',
  'at-risk':     'bg-amber-100 text-amber-700',
  'blocked':     'bg-red-100 text-red-700',
  'completed':   'bg-green-100 text-green-700',
  'overdue':     'bg-red-200 text-red-800',
}

export const STATUS_DOT: Record<WorksetStatus, string> = {
  'not-started': 'bg-slate-400',
  'in-progress': 'bg-blue-500',
  'at-risk':     'bg-amber-500',
  'blocked':     'bg-red-500',
  'completed':   'bg-green-500',
  'overdue':     'bg-red-700',
}

// ─── Priority ─────────────────────────────────────────────────────────────────

export const PRIORITY_LABELS: Record<Priority, string> = {
  low:      'Low',
  medium:   'Medium',
  high:     'High',
  critical: 'Critical',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  low:      'bg-slate-100 text-slate-600',
  medium:   'bg-blue-50 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700 font-semibold',
}

// ─── Risk ─────────────────────────────────────────────────────────────────────

export const RISK_LABELS: Record<RiskLevel, string> = {
  low:      'Low Risk',
  medium:   'Medium Risk',
  high:     'High Risk',
  critical: 'Critical Risk',
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  low:      'bg-green-50 text-green-700',
  medium:   'bg-yellow-50 text-yellow-700',
  high:     'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700',
}

// ─── Notification ─────────────────────────────────────────────────────────────

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  reminder:   '⏰',
  escalation: '🚨',
  blocked:    '🚫',
  phase:      '📅',
  update:     '📝',
  info:       'ℹ️',
}

// ─── Role ─────────────────────────────────────────────────────────────────────

export const ROLE_COLORS: Record<string, string> = {
  admin:  'bg-purple-100 text-purple-700',
  pm:     'bg-blue-100 text-blue-700',
  lead:   'bg-indigo-100 text-indigo-700',
  viewer: 'bg-slate-100 text-slate-600',
}

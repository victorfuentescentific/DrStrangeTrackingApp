'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Workset, Notification, FilterState, User, ClaudeCommand, ClaudeCommandResult,
  WorksetStatus,
} from './types'
import { MOCK_WORKSETS, MOCK_USERS } from './mock-data'
import { generateId, generateWorksetId, daysUntil } from './utils'
import { runNotificationEngine } from './notification-engine'
import { processClaudeCommand as simulateClaudeCommand } from './claude-simulator'
import { WorkflowType, Region } from './types'
import { calculateSuccessorETA, addWorkingDays, getSuccessorStartDate } from './eta-calculator'

interface AppStore {
  // ─── Data ────────────────────────────────────────────────────────────────────
  worksets: Workset[]
  notifications: Notification[]
  currentUser: User
  filters: FilterState

  // ─── UI ──────────────────────────────────────────────────────────────────────
  isNotificationPanelOpen: boolean
  isInitialized: boolean

  // ─── Actions ─────────────────────────────────────────────────────────────────
  initialize: () => void
  addWorkset: (data: Omit<Workset, 'id' | 'worksetId' | 'createdAt' | 'updatedAt' | 'auditTrail'>) => Workset
  updateWorkset: (id: string, updates: Partial<Workset>, reason?: string) => void
  deleteWorkset: (id: string) => void
  setCurrentUser: (userId: string) => void
  setFilter: (key: keyof FilterState, value: unknown) => void
  clearFilters: () => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  toggleNotificationPanel: () => void
  refreshNotifications: () => void
  processClaudeCommand: (command: ClaudeCommand) => ClaudeCommandResult
  linkSuccessor:   (set1Id: string, set2Id: string) => void
  unlinkSuccessor: (worksetId: string) => void

  // ─── Derived ─────────────────────────────────────────────────────────────────
  getFilteredWorksets: () => Workset[]
  getStats: () => {
    total: number
    overdue: number
    atRisk: number
    blocked: number
    completed: number
    inProgress: number
    notStarted: number
    escalated: number
    unreadNotifications: number
  }
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  workflow: 'all',
  region: 'all',
  locale: '',
  status: 'all',
  priority: 'all',
  riskLevel: 'all',
  showBlockedOnly: false,
  showEscalatedOnly: false,
  dateFrom: '',
  dateTo: '',
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      worksets: MOCK_WORKSETS,
      notifications: [],
      currentUser: MOCK_USERS[0],
      filters: DEFAULT_FILTERS,
      isNotificationPanelOpen: false,
      isInitialized: false,

      initialize: () => {
        if (get().isInitialized) return
        const worksets = get().worksets

        // Auto-update overdue status
        const updated = worksets.map(ws => {
          if (ws.status === 'completed') return ws
          const effectiveEta = ws.revisedEta ?? ws.eta
          const days = daysUntil(effectiveEta)
          if (days < 0 && ws.status !== 'overdue') {
            return { ...ws, status: 'overdue' as WorksetStatus, updatedAt: new Date().toISOString().split('T')[0] }
          }
          if (days >= 0 && days <= 3 && ws.status === 'in-progress' &&
              (ws.riskLevel === 'high' || ws.riskLevel === 'critical')) {
            return { ...ws, status: 'at-risk' as WorksetStatus, updatedAt: new Date().toISOString().split('T')[0] }
          }
          return ws
        })

        const notifications = runNotificationEngine(updated)
        set({ worksets: updated, notifications, isInitialized: true })
      },

      addWorkset: (data) => {
        const worksets = get().worksets
        const newWorkset: Workset = {
          ...data,
          id: generateId(),
          worksetId: generateWorksetId(worksets.map(w => w.worksetId)),
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
          auditTrail: [],
        }
        set(state => ({ worksets: [newWorkset, ...state.worksets] }))
        return newWorkset
      },

      updateWorkset: (id, updates, reason) => {
        set(state => {
          const today = new Date().toISOString().split('T')[0]
          const updatedWorksets = state.worksets.map(ws => {
            if (ws.id !== id) return ws
            const auditEntries = Object.entries(updates)
              .filter(([key]) => key !== 'auditTrail' && key !== 'updatedAt')
              .map(([field, newValue]) => ({
                id: generateId(),
                field,
                oldValue: String(ws[field as keyof Workset] ?? ''),
                newValue: String(newValue ?? ''),
                changedBy: state.currentUser.name,
                changedAt: new Date().toISOString(),
                reason,
              }))
            return {
              ...ws,
              ...updates,
              updatedAt: today,
              auditTrail: [...ws.auditTrail, ...auditEntries],
            }
          })

          // Cascade to successor only when ETA-related fields actually changed.
          const set1 = updatedWorksets.find(w => w.id === id)
          const successor = set1?.phases
            ? updatedWorksets.find(w => w.predecessorId === id)
            : null

          const etaChanged = updates.eta !== undefined || updates.revisedEta !== undefined || updates.phases !== undefined
          if (successor && set1?.phases && etaChanged) {
            const effectiveSet1Phases = set1.revisedEta
              ? { ...set1.phases, etaDate: set1.revisedEta }
              : set1.phases
            const newPhases = calculateSuccessorETA(
              effectiveSet1Phases, successor.workflow, successor.locale, successor.teamSize,
            )
            return {
              worksets: updatedWorksets.map(w => w.id === successor.id ? {
                ...w,
                phases:    newPhases,
                startDate: getSuccessorStartDate(effectiveSet1Phases.etaDate),
                eta:       newPhases.etaDate,
                updatedAt: today,
              } : w),
            }
          }

          return { worksets: updatedWorksets }
        })
      },

      deleteWorkset: (id) => {
        set(state => ({
          worksets: state.worksets
            .filter(ws => ws.id !== id)
            .map(ws => ws.predecessorId === id ? { ...ws, predecessorId: undefined } : ws),
        }))
      },

      linkSuccessor: (set1Id, set2Id) => {
        const { worksets } = get()
        const set1 = worksets.find(w => w.id === set1Id)
        if (!set1?.phases) return
        const set2 = worksets.find(w => w.id === set2Id)
        if (!set2) return

        const newPhases = calculateSuccessorETA(
          set1.phases, set2.workflow, set2.locale, set2.teamSize,
        )
        const today = new Date().toISOString().split('T')[0]
        set(state => ({
          worksets: state.worksets.map(ws => {
            if (ws.id !== set2Id) return ws
            return {
              ...ws,
              predecessorId: set1Id,
              phases:        newPhases,
              startDate:     getSuccessorStartDate(set1.phases!.etaDate),
              eta:           newPhases.etaDate,
              updatedAt:     today,
            }
          }),
        }))
      },

      unlinkSuccessor: (worksetId) => {
        const today = new Date().toISOString().split('T')[0]
        set(state => ({
          worksets: state.worksets.map(ws => {
            if (ws.id !== worksetId) return ws
            const { headStart: _hs, ...phasesWithoutHS } = ws.phases ?? {}
            return {
              ...ws,
              predecessorId: undefined,
              phases: ws.phases ? { ...phasesWithoutHS } as typeof ws.phases : undefined,
              updatedAt: today,
            }
          }),
        }))
      },

      setCurrentUser: (userId) => {
        const user = MOCK_USERS.find(u => u.id === userId)
        if (user) set({ currentUser: user })
      },

      setFilter: (key, value) => {
        set(state => ({ filters: { ...state.filters, [key]: value } }))
      },

      clearFilters: () => set({ filters: DEFAULT_FILTERS }),

      markNotificationRead: (id) => {
        set(state => ({
          notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
        }))
      },

      markAllNotificationsRead: () => {
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        }))
      },

      toggleNotificationPanel: () => {
        set(state => ({ isNotificationPanelOpen: !state.isNotificationPanelOpen }))
      },

      refreshNotifications: () => {
        const notifications = runNotificationEngine(get().worksets)
        set({ notifications })
      },

      processClaudeCommand: (command) => {
        return simulateClaudeCommand(command, get().worksets)
      },

      getFilteredWorksets: () => {
        const { worksets, filters } = get()
        return worksets.filter(ws => {
          if (filters.search) {
            const q = filters.search.toLowerCase()
            if (!ws.name.toLowerCase().includes(q) &&
                !ws.worksetId.toLowerCase().includes(q) &&
                !ws.locale.toLowerCase().includes(q) &&
                !ws.workflow.toLowerCase().includes(q)) return false
          }
          if (filters.workflow !== 'all' && ws.workflow !== (filters.workflow as WorkflowType)) return false
          if (filters.region !== 'all' && ws.region !== (filters.region as Region)) return false
          if (filters.locale && !ws.locale.toLowerCase().includes(filters.locale.toLowerCase())) return false
          if (filters.status !== 'all' && ws.status !== filters.status) return false
          if (filters.priority !== 'all' && ws.priority !== filters.priority) return false
          if (filters.riskLevel !== 'all' && ws.riskLevel !== filters.riskLevel) return false
          if (filters.showBlockedOnly && !ws.isBlocked) return false
          if (filters.showEscalatedOnly && !ws.isEscalated) return false
          if (filters.dateFrom) {
            const eta = ws.revisedEta ?? ws.eta
            if (eta < filters.dateFrom) return false
          }
          if (filters.dateTo) {
            const eta = ws.revisedEta ?? ws.eta
            if (eta > filters.dateTo) return false
          }
          return true
        })
      },

      getStats: () => {
        const { worksets, notifications } = get()
        return {
          total:               worksets.length,
          overdue:             worksets.filter(w => w.status === 'overdue').length,
          atRisk:              worksets.filter(w => w.status === 'at-risk' || (w.riskLevel === 'high' || w.riskLevel === 'critical') && w.status !== 'completed').length,
          blocked:             worksets.filter(w => w.isBlocked && w.status !== 'completed').length,
          completed:           worksets.filter(w => w.status === 'completed').length,
          inProgress:          worksets.filter(w => w.status === 'in-progress').length,
          notStarted:          worksets.filter(w => w.status === 'not-started').length,
          escalated:           worksets.filter(w => w.isEscalated && w.status !== 'completed').length,
          unreadNotifications: notifications.filter(n => !n.isRead).length,
        }
      },
    }),
    {
      name: 'workset-tracker-store-v2',
      partialize: (state) => ({
        worksets: state.worksets,
        currentUser: state.currentUser,
        isInitialized: state.isInitialized,
      }),
    },
  ),
)

export { MOCK_USERS }

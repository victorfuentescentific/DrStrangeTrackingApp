'use client'

import { create } from 'zustand'
import {
  Workset, Notification, FilterState, User, WorksetStatus,
} from './types'
import { MOCK_WORKSETS, MOCK_USERS } from './mock-data'
import { generateId, generateWorksetId, daysUntil } from './utils'
import { runNotificationEngine } from './notification-engine'
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
  initialize: () => Promise<void>
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
    (set, get) => ({
      worksets: [],
      notifications: [],
      currentUser: MOCK_USERS[0],
      filters: DEFAULT_FILTERS,
      isNotificationPanelOpen: false,
      isInitialized: false,

      initialize: async () => {
        if (get().isInitialized) return

        // Load worksets from Supabase via API
        let worksets: Workset[] = []
        try {
          const res = await fetch('/api/worksets')
          if (res.ok) {
            const data = await res.json()
            worksets = Array.isArray(data) ? data : []
          }
        } catch {
          // Network error — fall back to mock data so the app is usable
          worksets = MOCK_WORKSETS
        }

        // If DB is empty, seed with mock data
        if (worksets.length === 0) worksets = MOCK_WORKSETS

        // Auto-update overdue status (local only — DB update fires separately)
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
        // Optimistic update
        set(state => ({ worksets: [newWorkset, ...state.worksets] }))
        // Async DB sync (fire-and-forget)
        fetch('/api/worksets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newWorkset),
        }).catch(console.error)
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
          let finalWorksets = updatedWorksets

          if (successor && set1?.phases && etaChanged) {
            const effectiveSet1Phases = set1.revisedEta
              ? { ...set1.phases, etaDate: set1.revisedEta }
              : set1.phases
            const newPhases = calculateSuccessorETA(
              effectiveSet1Phases, successor.workflow, successor.locale, successor.teamSize,
            )
            finalWorksets = updatedWorksets.map(w => w.id === successor.id ? {
              ...w,
              phases:    newPhases,
              startDate: getSuccessorStartDate(effectiveSet1Phases.etaDate),
              eta:       newPhases.etaDate,
              updatedAt: today,
            } : w)

            // Sync successor to DB too
            const updatedSuccessor = finalWorksets.find(w => w.id === successor.id)
            if (updatedSuccessor) {
              fetch('/api/worksets', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedSuccessor),
              }).catch(console.error)
            }
          }

          // Sync primary workset to DB
          const updatedPrimary = finalWorksets.find(w => w.id === id)
          if (updatedPrimary) {
            fetch('/api/worksets', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatedPrimary),
            }).catch(console.error)
          }

          return { worksets: finalWorksets }
        })
      },

      deleteWorkset: (id) => {
        set(state => ({
          worksets: state.worksets
            .filter(ws => ws.id !== id)
            .map(ws => ws.predecessorId === id ? { ...ws, predecessorId: undefined } : ws),
        }))
        fetch(`/api/worksets?id=${id}`, { method: 'DELETE' }).catch(console.error)
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
        const updatedSet2 = {
          ...set2,
          predecessorId: set1Id,
          phases:        newPhases,
          startDate:     getSuccessorStartDate(set1.phases!.etaDate),
          eta:           newPhases.etaDate,
          updatedAt:     today,
        }
        set(state => ({
          worksets: state.worksets.map(ws => ws.id !== set2Id ? ws : updatedSet2),
        }))
        fetch('/api/worksets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedSet2),
        }).catch(console.error)
      },

      unlinkSuccessor: (worksetId) => {
        const today = new Date().toISOString().split('T')[0]
        set(state => ({
          worksets: state.worksets.map(ws => {
            if (ws.id !== worksetId) return ws
            const { headStart: _hs, ...phasesWithoutHS } = ws.phases ?? {}
            const updated = {
              ...ws,
              predecessorId: undefined,
              phases: ws.phases ? { ...phasesWithoutHS } as typeof ws.phases : undefined,
              updatedAt: today,
            }
            fetch('/api/worksets', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated),
            }).catch(console.error)
            return updated
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
)

export { MOCK_USERS }

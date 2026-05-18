import { Workset, Notification, NotificationType, NotificationPriority } from './types'
import { daysUntil, generateId } from './utils'
import { differenceInCalendarDays, parseISO } from 'date-fns'

function makeNotification(
  type: NotificationType,
  title: string,
  message: string,
  priority: NotificationPriority,
  workset?: Workset,
): Notification {
  return {
    id: generateId(),
    type,
    title,
    message,
    worksetId: workset?.id,
    worksetName: workset?.name,
    isRead: false,
    createdAt: new Date().toISOString(),
    priority,
  }
}

function daysFromToday(dateStr: string): number {
  try {
    return differenceInCalendarDays(parseISO(dateStr), new Date())
  } catch {
    return 999
  }
}

export function runNotificationEngine(worksets: Workset[]): Notification[] {
  const notifications: Notification[] = []
  const active = worksets.filter(w => w.status !== 'completed')

  for (const ws of active) {
    const effectiveEta = ws.revisedEta ?? ws.eta
    const days = daysUntil(effectiveEta)

    // ─── ETA reminders ───────────────────────────────────────────────────────
    if (days < 0 && ws.status !== 'overdue') {
      notifications.push(makeNotification(
        'escalation',
        `Overdue: ${ws.worksetId}`,
        `"${ws.name}" (${ws.locale}) is ${Math.abs(days)} day(s) past ETA. Owner region: ${ws.region}.`,
        'high', ws,
      ))
    } else if (days === 0) {
      notifications.push(makeNotification(
        'reminder',
        `Due Today: ${ws.worksetId}`,
        `"${ws.name}" (${ws.locale}) is due today. Region: ${ws.region}.`,
        'high', ws,
      ))
    } else if (days === 1) {
      notifications.push(makeNotification(
        'reminder',
        `Due Tomorrow: ${ws.worksetId}`,
        `"${ws.name}" (${ws.locale}) is due tomorrow. Region: ${ws.region}.`,
        'high', ws,
      ))
    } else if (days <= 3 && (ws.riskLevel === 'high' || ws.riskLevel === 'critical')) {
      notifications.push(makeNotification(
        'reminder',
        `At Risk — ETA in ${days}d: ${ws.worksetId}`,
        `"${ws.name}" (${ws.locale}) has high risk and is due in ${days} days.`,
        'medium', ws,
      ))
    }

    // ─── Blocker / escalation ─────────────────────────────────────────────
    if (ws.isBlocked) {
      notifications.push(makeNotification(
        'blocked',
        `Blocked: ${ws.worksetId}`,
        `"${ws.name}" is blocked — ${ws.blockerDescription ?? 'No description provided.'}`,
        'high', ws,
      ))
    }

    if (ws.isEscalated) {
      notifications.push(makeNotification(
        'escalation',
        `Escalated: ${ws.worksetId}`,
        `"${ws.name}" has been escalated — ${ws.escalationReason ?? 'Review required.'}`,
        'high', ws,
      ))
    }

    // ─── Phase reminders (2P and PHI start) ──────────────────────────────
    if (ws.phases) {
      const { p2Start, phiStart } = ws.phases
      const d2p  = daysFromToday(p2Start)
      const dphi = daysFromToday(phiStart)

      if (d2p === 0) {
        notifications.push(makeNotification(
          'phase',
          `2P Starts Today: ${ws.worksetId}`,
          `2nd Pass annotation begins today for "${ws.name}" (${ws.locale}, ${ws.workflow}).`,
          'medium', ws,
        ))
      } else if (d2p === 1) {
        notifications.push(makeNotification(
          'phase',
          `2P Starts Tomorrow: ${ws.worksetId}`,
          `2nd Pass annotation starts tomorrow for "${ws.name}" (${ws.locale}, ${ws.workflow}).`,
          'medium', ws,
        ))
      } else if (d2p === 3) {
        notifications.push(makeNotification(
          'phase',
          `2P in 3 Days: ${ws.worksetId}`,
          `2nd Pass annotation starts in 3 days for "${ws.name}" (${ws.locale}, ${ws.workflow}). Prepare 2P team.`,
          'low', ws,
        ))
      }

      // PHI reminders (only if different from 2P start — sequential model)
      if (ws.phases.model === 'Sequential' && dphi !== d2p) {
        if (dphi === 0) {
          notifications.push(makeNotification(
            'phase',
            `PHI Starts Today: ${ws.worksetId}`,
            `PHI phase begins today for "${ws.name}" (${ws.locale}, ${ws.workflow}).`,
            'medium', ws,
          ))
        } else if (dphi === 1) {
          notifications.push(makeNotification(
            'phase',
            `PHI Starts Tomorrow: ${ws.worksetId}`,
            `PHI phase starts tomorrow for "${ws.name}" (${ws.locale}, ${ws.workflow}).`,
            'low', ws,
          ))
        }
      }
    }
  }

  return notifications
}

export function generateDailySummaryText(worksets: Workset[]): string {
  const today = new Date().toDateString()
  const overdue   = worksets.filter(w => w.status === 'overdue')
  const dueSoon   = worksets.filter(w => {
    const d = daysUntil(w.revisedEta ?? w.eta)
    return d >= 0 && d <= 3 && w.status !== 'completed'
  })
  const blocked   = worksets.filter(w => w.isBlocked && w.status !== 'completed')
  const completed = worksets.filter(w => w.status === 'completed')

  const lines: string[] = [
    `## Daily PM Summary — ${today}`,
    '',
    `**Total Worksets:** ${worksets.length} | **Completed:** ${completed.length} | **Active:** ${worksets.length - completed.length}`,
    '',
  ]

  if (overdue.length > 0) {
    lines.push(`### 🚨 Overdue (${overdue.length})`)
    overdue.forEach(w => {
      const days = Math.abs(daysUntil(w.revisedEta ?? w.eta))
      lines.push(`- **${w.worksetId}** ${w.name} [${w.locale}] — ${days}d overdue — Region: ${w.region}${w.isEscalated ? ' — ESCALATED' : ''}`)
    })
    lines.push('')
  }

  if (blocked.length > 0) {
    lines.push(`### 🚫 Blocked (${blocked.length})`)
    blocked.forEach(w => {
      lines.push(`- **${w.worksetId}** ${w.name} [${w.locale}] — ${w.blockerDescription ?? 'Blocker not described'} — Region: ${w.region}`)
    })
    lines.push('')
  }

  if (dueSoon.length > 0) {
    lines.push(`### ⏰ Due in Next 3 Days (${dueSoon.length})`)
    dueSoon.forEach(w => {
      const days = daysUntil(w.revisedEta ?? w.eta)
      const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `+${days}d`
      lines.push(`- **${w.worksetId}** ${w.name} [${w.locale}] — ${label} — Risk: ${w.riskLevel.toUpperCase()} — Region: ${w.region}`)
    })
    lines.push('')
  }

  if (overdue.length === 0 && blocked.length === 0 && dueSoon.length === 0) {
    lines.push('✅ No urgent items today. All active worksets are on track.')
  }

  return lines.join('\n')
}

export function generateWeeklyReportText(worksets: Workset[]): string {
  const highRisk  = worksets.filter(w => (w.riskLevel === 'high' || w.riskLevel === 'critical') && w.status !== 'completed')
  const overdue   = worksets.filter(w => w.status === 'overdue')
  const blocked   = worksets.filter(w => w.isBlocked && w.status !== 'completed')
  const escalated = worksets.filter(w => w.isEscalated && w.status !== 'completed')
  const completed = worksets.filter(w => w.status === 'completed')
  const upcoming  = worksets.filter(w => {
    const d = daysUntil(w.revisedEta ?? w.eta)
    return d >= 0 && d <= 7 && w.status !== 'completed'
  })

  const lines: string[] = [
    `## Weekly Risk Report — Week of ${new Date().toDateString()}`,
    '',
    `### Executive Summary`,
    `- ${worksets.length} total worksets tracked`,
    `- ${completed.length} completed (${worksets.length ? Math.round((completed.length / worksets.length) * 100) : 0}% completion rate)`,
    `- ${overdue.length} overdue | ${blocked.length} blocked | ${escalated.length} escalated`,
    `- ${highRisk.length} high/critical risk items requiring attention`,
    '',
  ]

  if (escalated.length > 0) {
    lines.push('### 🚨 Escalations Requiring Leadership Attention')
    escalated.forEach(w => lines.push(`- **${w.worksetId}** ${w.name} — ${w.escalationReason ?? 'Review required'}`))
    lines.push('')
  }

  if (overdue.length > 0) {
    lines.push('### 🔴 Overdue Worksets')
    overdue.forEach(w => {
      const days = Math.abs(daysUntil(w.revisedEta ?? w.eta))
      lines.push(`- **${w.worksetId}** ${w.name} [${w.locale}] — ${days}d overdue — ${w.region} — ${w.workflow}`)
    })
    lines.push('')
  }

  if (upcoming.length > 0) {
    lines.push('### 📅 ETAs Due This Week')
    upcoming.forEach(w => {
      const d = daysUntil(w.revisedEta ?? w.eta)
      const label = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `+${d}d`
      lines.push(`- **${w.worksetId}** ${w.name} [${w.locale}] — ${label} — ${w.region} — Risk: ${w.riskLevel}`)
    })
    lines.push('')
  }

  lines.push('### 📌 Recommended Actions')
  if (overdue.length > 0)   lines.push(`- Immediate follow-up on ${overdue.length} overdue workset(s)`)
  if (blocked.length > 0)   lines.push(`- Unblock ${blocked.length} workset(s)`)
  if (escalated.length > 0) lines.push(`- Leadership review of ${escalated.length} escalated item(s)`)
  if (overdue.length === 0 && blocked.length === 0) lines.push('- Continue monitoring upcoming ETAs')

  return lines.join('\n')
}

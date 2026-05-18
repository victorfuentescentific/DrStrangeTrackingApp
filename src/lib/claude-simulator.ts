import { ClaudeCommand, ClaudeCommandResult, Workset } from './types'
import { daysUntil, generateId, generateWorksetId } from './utils'
import { generateDailySummaryText, generateWeeklyReportText } from './notification-engine'

export function processClaudeCommand(
  command: ClaudeCommand,
  worksets: Workset[],
): ClaudeCommandResult {
  try {
    switch (command.command) {
      case 'daily_summary': {
        const output = generateDailySummaryText(worksets)
        return { success: true, output, actions: ['Copy to clipboard', 'Send via Teams', 'Send via Email'] }
      }

      case 'weekly_report': {
        const output = generateWeeklyReportText(worksets)
        return { success: true, output, actions: ['Copy to clipboard', 'Send to Leadership', 'Export PDF'] }
      }

      case 'get_overdue': {
        const overdue = worksets.filter(w => w.status === 'overdue')
        if (overdue.length === 0) {
          return { success: true, output: '✅ No overdue worksets. All items are within ETA.', data: [] }
        }
        const lines = ['## Overdue Worksets', '']
        overdue.forEach(w => {
          const days = Math.abs(daysUntil(w.revisedEta ?? w.eta))
          lines.push(`**${w.worksetId}** — ${w.name} [${w.locale}]`)
          lines.push(`  Workflow: ${w.workflow} | Region: ${w.region} | ${days}d overdue | Risk: ${w.riskLevel} | Priority: ${w.priority}`)
          lines.push(`  Notes: ${w.notes || 'N/A'}`)
          lines.push('')
        })
        return {
          success: true,
          output: lines.join('\n'),
          data: overdue,
          actions: [`Escalate all ${overdue.length}`, 'Generate reminder messages', 'Export list'],
        }
      }

      case 'get_blocked': {
        const blocked = worksets.filter(w => w.isBlocked && w.status !== 'completed')
        if (blocked.length === 0) {
          return { success: true, output: '✅ No blocked worksets.', data: [] }
        }
        const lines = ['## Blocked Worksets', '']
        blocked.forEach(w => {
          lines.push(`**${w.worksetId}** — ${w.name} [${w.locale}]`)
          lines.push(`  Blocker: ${w.blockerDescription ?? 'Not described'}`)
          lines.push(`  Workflow: ${w.workflow} | Region: ${w.region} | ETA: ${w.revisedEta ?? w.eta}`)
          lines.push('')
        })
        return {
          success: true,
          output: lines.join('\n'),
          data: blocked,
          actions: ['Generate unblock requests', 'Escalate blocked items'],
        }
      }

      case 'get_at_risk': {
        const atRisk = worksets.filter(w =>
          (w.status === 'at-risk' || w.riskLevel === 'high' || w.riskLevel === 'critical') &&
          w.status !== 'completed'
        )
        const lines = ['## At-Risk Worksets', '']
        atRisk.forEach(w => {
          const d = daysUntil(w.revisedEta ?? w.eta)
          lines.push(`**${w.worksetId}** — ${w.name} [${w.locale}]`)
          lines.push(`  Risk: ${w.riskLevel.toUpperCase()} | ETA: ${d < 0 ? `${Math.abs(d)}d overdue` : `+${d}d`} | Workflow: ${w.workflow} | Region: ${w.region}`)
          lines.push('')
        })
        return { success: true, output: lines.join('\n'), data: atRisk, actions: ['Suggest mitigations'] }
      }

      case 'generate_reminder': {
        const wsId = command.params?.worksetId as string | undefined
        const ws = wsId ? worksets.find(w => w.id === wsId || w.worksetId === wsId) : undefined
        if (!ws) {
          return {
            success: false,
            output: 'Workset not found. Provide a valid worksetId in params.',
            error: 'WORKSET_NOT_FOUND',
          }
        }
        const d = daysUntil(ws.revisedEta ?? ws.eta)
        const output = [
          `Hi [${ws.region} Team],`,
          '',
          `This is a reminder that **${ws.worksetId} — ${ws.name}** (${ws.locale}, ${ws.workflow}) has an ETA of **${ws.revisedEta ?? ws.eta}** (${d < 0 ? `${Math.abs(d)} days overdue` : d === 0 ? 'today' : `in ${d} day(s)`}).`,
          '',
          ws.isBlocked ? `⚠️ **Blocked:** ${ws.blockerDescription}` : '',
          `Current status: **${ws.status.toUpperCase()}** | Risk: **${ws.riskLevel.toUpperCase()}**`,
          '',
          'Please provide a status update or revised ETA at your earliest convenience.',
          '',
          'Thank you,',
          'PM Automation',
        ].filter(l => l !== '').join('\n')
        return { success: true, output, actions: ['Send via Teams', 'Send via Email', 'Copy'] }
      }

      case 'generate_escalation': {
        const wsId = command.params?.worksetId as string | undefined
        const ws = wsId ? worksets.find(w => w.id === wsId || w.worksetId === wsId) : undefined
        if (!ws) {
          return {
            success: false,
            output: 'Workset not found. Provide a valid worksetId in params.',
            error: 'WORKSET_NOT_FOUND',
          }
        }
        const d = daysUntil(ws.revisedEta ?? ws.eta)
        const output = [
          `**ESCALATION — ${ws.worksetId}: ${ws.name}**`,
          '',
          `**Date:** ${new Date().toDateString()}`,
          `**Workflow:** ${ws.workflow} | **Team:** ${ws.team} | **Region:** ${ws.region}`,
          `**Locale:** ${ws.locale} | **Team Size:** N=${ws.teamSize}`,
          `**Original ETA:** ${ws.eta}${ws.revisedEta ? ` | **Revised ETA:** ${ws.revisedEta}` : ''}`,
          `**Status:** ${d < 0 ? `${Math.abs(d)} days OVERDUE` : `Due in ${d} days`}`,
          '',
          `**Issue:**`,
          ws.escalationReason ?? ws.blockerDescription ?? ws.notes ?? 'Requires leadership review.',
          '',
          '**Requested Action:** Please review and advise on path forward.',
        ].join('\n')
        return { success: true, output, actions: ['Send to Leadership', 'Copy', 'Create Teams Meeting'] }
      }

      case 'suggest_actions': {
        const actions: string[] = []
        const overdue = worksets.filter(w => w.status === 'overdue')
        const blocked = worksets.filter(w => w.isBlocked && w.status !== 'completed')
        const atRisk = worksets.filter(w => w.status === 'at-risk' || w.riskLevel === 'critical')

        const lines = ['## Suggested PM Actions', '']
        if (overdue.length > 0) {
          lines.push(`**Immediate (Today):**`)
          overdue.forEach(w => {
            lines.push(`- Follow up with ${w.region} team on **${w.worksetId}** — ${Math.abs(daysUntil(w.revisedEta ?? w.eta))}d overdue`)
          })
          lines.push('')
        }
        if (blocked.length > 0) {
          lines.push(`**Unblock Required:**`)
          blocked.forEach(w => {
            lines.push(`- Resolve blocker for **${w.worksetId}**: ${w.blockerDescription ?? 'See notes'}`)
          })
          lines.push('')
        }
        if (atRisk.length > 0) {
          lines.push(`**Risk Mitigation:**`)
          atRisk.forEach(w => {
            lines.push(`- Review resource allocation for **${w.worksetId}** — ${w.name}`)
          })
          lines.push('')
        }
        if (overdue.length === 0 && blocked.length === 0 && atRisk.length === 0) {
          lines.push('✅ No urgent actions required. Consider reviewing next-week ETAs proactively.')
        }
        return { success: true, output: lines.join('\n'), actions }
      }

      case 'create_workset': {
        const p = command.params ?? {}
        const today = new Date().toISOString().split('T')[0]
        const newWorkset: Workset = {
          id: generateId(),
          worksetId: generateWorksetId(worksets.map(w => w.worksetId)),
          name: (p.name as string) ?? 'New Workset',
          workflow: (p.workflow as 'DAX' | 'DMO' | 'Scribing') ?? 'DAX',
          locale: (p.locale as string) ?? 'en_GB',
          team: (p.team as 'Transcription' | 'Scribing') ?? 'Transcription',
          region: (p.region as 'EU' | 'US' | 'IN') ?? 'EU',
          teamSize: (p.teamSize as number) ?? 11,
          startDate: (p.startDate as string) ?? today,
          status: 'not-started',
          priority: (p.priority as 'low' | 'medium' | 'high' | 'critical') ?? 'medium',
          riskLevel: (p.riskLevel as 'low' | 'medium' | 'high' | 'critical') ?? 'low',
          eta: (p.eta as string) ?? new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          isBlocked: false,
          isEscalated: false,
          notes: (p.notes as string) ?? '',
          createdAt: today,
          updatedAt: today,
          auditTrail: [],
        }
        return {
          success: true,
          output: `✅ Workset **${newWorkset.worksetId}** — "${newWorkset.name}" created successfully.\n\nReview the details below and click **Apply to App** to add it.`,
          data: newWorkset,
          actions: ['Apply to App', 'Edit JSON', 'Discard'],
        }
      }

      case 'parse_notes': {
        const notes = (command.rawPrompt ?? command.params?.notes ?? '') as string
        return {
          success: true,
          output: `## Parsed from Notes\n\nThe following structured updates were extracted:\n\n\`\`\`json\n${JSON.stringify({
            note: 'In a full Claude API integration, this would extract workset IDs, status changes, ETA revisions, and blockers from the provided meeting notes.',
            rawInput: notes.slice(0, 200),
            extractedUpdates: [],
          }, null, 2)}\`\`\`\n\nConnect the Claude API in Phase 2 to enable real extraction.`,
          actions: ['Connect Claude API'],
        }
      }

      default: {
        return {
          success: false,
          output: `Unknown command: ${command.command}`,
          error: 'UNKNOWN_COMMAND',
        }
      }
    }
  } catch (err) {
    return {
      success: false,
      output: 'An error occurred while processing the command.',
      error: String(err),
    }
  }
}

export const EXAMPLE_COMMANDS: { label: string; command: ClaudeCommand }[] = [
  { label: 'Daily Summary',         command: { command: 'daily_summary' } },
  { label: 'Weekly Risk Report',    command: { command: 'weekly_report' } },
  { label: 'List Overdue',          command: { command: 'get_overdue' } },
  { label: 'List Blocked',          command: { command: 'get_blocked' } },
  { label: 'List At-Risk',          command: { command: 'get_at_risk' } },
  { label: 'Suggest Actions',       command: { command: 'suggest_actions' } },
  {
    label: 'Reminder (WS-001)',
    command: { command: 'generate_reminder', params: { worksetId: 'WS-001' } },
  },
  {
    label: 'Escalation (WS-001)',
    command: { command: 'generate_escalation', params: { worksetId: 'WS-001' } },
  },
  {
    label: 'Create Workset (sample)',
    command: {
      command: 'create_workset',
      params: {
        name: 'Sample New Workset',
        workflow: 'DAX',
        locale: 'de_DE',
        team: 'Transcription',
        region: 'EU',
        teamSize: 11,
        priority: 'medium',
        riskLevel: 'low',
        eta: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
      },
    },
  },
]

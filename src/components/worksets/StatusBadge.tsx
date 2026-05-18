import { Badge } from '@/components/ui/Badge'
import { WorksetStatus, Priority, RiskLevel } from '@/lib/types'
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, RISK_COLORS, RISK_LABELS } from '@/lib/utils'

export function StatusBadge({ status }: { status: WorksetStatus }) {
  return <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={PRIORITY_COLORS[priority]}>{PRIORITY_LABELS[priority]}</Badge>
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <Badge className={RISK_COLORS[risk]}>{RISK_LABELS[risk]}</Badge>
}

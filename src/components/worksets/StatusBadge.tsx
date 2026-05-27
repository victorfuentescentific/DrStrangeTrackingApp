import { Badge } from '@/components/ui/Badge'
import { WorksetStatus, Priority, RiskLevel } from '@/lib/types'
import {
  STATUS_COLORS, STATUS_LABELS,
  PRIORITY_COLORS, PRIORITY_LABELS,
  RISK_COLORS, RISK_LABELS,
  getEffectiveRisk, expiryCountdownLabel,
  daysUntil,
} from '@/lib/utils'
import { CalendarClock } from 'lucide-react'

export function StatusBadge({ status }: { status: WorksetStatus }) {
  return <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={PRIORITY_COLORS[priority]}>{PRIORITY_LABELS[priority]}</Badge>
}

interface RiskBadgeProps {
  risk:            RiskLevel
  expirationDate?: string
  status?:         WorksetStatus
}

export function RiskBadge({ risk, expirationDate, status }: RiskBadgeProps) {
  const effective  = getEffectiveRisk(risk, expirationDate, status)
  const overriding = effective !== risk && !!expirationDate && status !== 'completed'

  // Show expiry countdown chip when expiry is set and within the warning window (≤ 30d)
  const showExpiry =
    !!expirationDate &&
    status !== 'completed' &&
    daysUntil(expirationDate) <= 30

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <Badge className={RISK_COLORS[effective]}>
        {RISK_LABELS[effective]}
        {overriding && ' ↑'}
      </Badge>
      {showExpiry && (
        <span
          title={expiryCountdownLabel(expirationDate!)}
          className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none"
        >
          <CalendarClock className="w-2.5 h-2.5" />
          {daysUntil(expirationDate!) <= 0 ? 'Expired' : `${daysUntil(expirationDate!)}d`}
        </span>
      )}
    </span>
  )
}

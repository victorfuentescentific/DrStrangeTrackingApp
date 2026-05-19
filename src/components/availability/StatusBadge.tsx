'use client'

import { STATUS_CONFIG, type AvailabilityStatus } from '@/lib/availability-types'

interface StatusBadgeProps {
  status: AvailabilityStatus
  employeeType?: string | null
  hours?: number | null
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, employeeType, hours, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  // FTE NO = normal working day (grey), FL NO = unavailable (red)
  const colorClass =
    status === 'NO' && employeeType === 'FTE'
      ? config.ftColor ?? config.color
      : config.color

  const sizeClass = size === 'sm'
    ? 'px-1.5 py-0.5 text-xs'
    : 'px-2.5 py-1 text-sm'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${colorClass} ${sizeClass}`}>
      {config.label}
      {hours != null && hours > 0 && (
        <span className="opacity-70">· {hours}h</span>
      )}
    </span>
  )
}

import type { ReactNode } from 'react'

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'
type StatusBadgeProps = { tone?: StatusTone; children: ReactNode }

export function StatusBadge({ tone = 'neutral', children }: StatusBadgeProps) {
  return <span className={`status-badge status-badge-${tone}`}><span className="status-badge-dot" aria-hidden="true" />{children}</span>
}
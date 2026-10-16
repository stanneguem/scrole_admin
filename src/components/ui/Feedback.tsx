import type { ReactNode } from 'react'

export function LoadingState({ label = 'Chargement...' }: { label?: string }) {
  return <div className="feedback-state"><span className="loading-spinner" aria-hidden="true" /><span>{label}</span></div>
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="feedback-state feedback-empty"><span className="feedback-icon" aria-hidden="true">—</span><strong>{title}</strong>{description && <span>{description}</span>}</div>
}

export function ErrorState({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return <div className="feedback-state feedback-error"><span className="feedback-icon" aria-hidden="true">!</span><strong>{children}</strong>{onRetry && <button type="button" onClick={onRetry}>Réessayer</button>}</div>
}
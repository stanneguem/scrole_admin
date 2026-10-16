import type { HTMLAttributes, ReactNode } from 'react'

type CardProps = HTMLAttributes<HTMLElement> & { children: ReactNode; title?: string; action?: ReactNode }

export function Card({ title, action, children, className = '', ...props }: CardProps) {
  return <section className={`scrole-card ${className}`.trim()} {...props}>{(title || action) && <header className="scrole-card-header">{title && <h2>{title}</h2>}{action}</header>}{children}</section>
}
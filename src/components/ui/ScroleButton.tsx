import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ScroleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; children: ReactNode }

export function ScroleButton({ variant = 'primary', children, className = '', ...props }: ScroleButtonProps) {
  return <button className={`scrole-button scrole-button-${variant} ${className}`.trim()} {...props}>{children}</button>
}
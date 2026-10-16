import type { InputHTMLAttributes, ReactNode } from 'react'
import { useState } from 'react'

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }

export function AuthInput({ label, error, hint, id, ...props }: AuthInputProps) {
  const inputId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  return <div className="field"><label htmlFor={inputId}>{label}</label><input id={inputId} className={error ? 'input input-error' : 'input'} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : hint ? hintId : undefined} {...props} />{hint && !error && <span className="field-hint" id={hintId}>{hint}</span>}{error && <span className="field-error" id={errorId} role="alert">{error}</span>}</div>
}

type PasswordInputProps = Omit<AuthInputProps, 'type'> & { strength?: ReactNode }

export function PasswordInput({ strength, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  return <div className="password-field"><AuthInput {...props} type={visible ? 'text' : 'password'} /><button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={visible}><EyeIcon visible={visible} /></button>{strength}</div>
}

export function AuthButton({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  return <button className="auth-button" type="submit" disabled={loading}>{loading ? <><span className="spinner" aria-hidden="true" />Traitement en cours</> : children}</button>
}
export function FormError({ children }: { children: ReactNode }) { return <div className="form-message form-message-error" role="alert"><span className="message-icon">!</span>{children}</div> }
export function FormSuccess({ children }: { children: ReactNode }) { return <div className="form-message form-message-success" role="status"><span className="message-icon">✓</span>{children}</div> }
function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.7 10.7 0 0 1 12 4.8c5.1 0 8.7 4.8 9.7 6.4a1.5 1.5 0 0 1 0 .9 17.4 17.4 0 0 1-3.5 4.1M6.2 6.2A17.8 17.8 0 0 0 2.3 11.2a1.5 1.5 0 0 0 0 1.6C3.4 14.5 7 19.2 12 19.2a10.8 10.8 0 0 0 2.3-.3" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.3 12.8a1.5 1.5 0 0 1 0-1.6C3.4 9.5 7 4.8 12 4.8s8.6 4.7 9.7 6.4a1.5 1.5 0 0 1 0 1.6c-1.1 1.7-4.7 6.4-9.7 6.4s-8.6-4.7-9.7-6.4Z" /><circle cx="12" cy="12" r="2.7" /></svg>
}
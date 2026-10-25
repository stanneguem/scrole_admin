import type { ReactNode } from 'react'
import { ScroleLogo } from '../brand/ScroleLogo'

type AuthLayoutProps = { eyebrow?: string; title: string; description: string; children: ReactNode }

export function AuthLayout({ eyebrow = 'Espace administration', title, description, children }: AuthLayoutProps) {
  return (
    <main className="auth-shell">
      <div className="auth-backdrop" aria-hidden="true"><span className="backdrop-line backdrop-line-one" /><span className="backdrop-line backdrop-line-two" /></div>
      <div className="auth-frame">
        <header className="brand-lockup">
          <a className="brand" href="/login" aria-label="Scrole, retour à la connexion"><ScroleLogo /></a>
          <span className="brand-context">Administration</span>
        </header>
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card-header"><p className="auth-eyebrow">{eyebrow}</p><h1 id="auth-title">{title}</h1><p className="auth-description">{description}</p></div>
          {children}
          <p className="auth-legal-notice">
            En vous connectant, vous reconnaissez avoir lu nos{' '}
            <a href="https://legal.scrole.fun/" target="_blank" rel="noopener noreferrer">conditions d’utilisation</a>
            {' '}et notre{' '}
            <a href="https://police.scrole.fun/" target="_blank" rel="noopener noreferrer">politique de confidentialité</a>.
          </p>
        </section>
        <footer className="auth-footer"><span className="status-dot" aria-hidden="true" /><span>Accès sécurisé</span><span className="footer-separator" aria-hidden="true">/</span><span>Scrole Admin</span></footer>
      </div>
    </main>
  )
}
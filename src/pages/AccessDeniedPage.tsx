import { ScroleLogo } from '../components/brand/ScroleLogo'
import '../theme/access.css'

export function AccessDeniedPage() {
  return <main className="access-denied"><ScroleLogo /><div className="access-panel"><span className="access-mark" aria-hidden="true">!</span><p className="auth-eyebrow">Accès refusé</p><h1>Cette zone est réservée</h1><p>Votre session est valide, mais votre compte ne possède pas les autorisations nécessaires pour accéder à Scrole Admin.</p><a className="scrole-button scrole-button-secondary" href="/login">Retour à la connexion</a></div></main>
}

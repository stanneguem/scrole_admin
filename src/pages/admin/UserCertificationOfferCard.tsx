import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { supabase } from '../../lib/supabase'

type Props = { userId: string; onDone: () => Promise<void> }
type Code = 'basique' | 'pro' | 'premium'
type ActiveCertification = { expires_at?: string | null; status?: string | null }
const labels: Record<Code, string> = { basique: 'Basique', pro: 'Pro', premium: 'Premium' }
const formatExpiry = (value?: string | null) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

export function UserCertificationOfferCard({ userId, onDone }: Props) {
  const [code, setCode] = useState<Code>('basique'); const [months, setMonths] = useState('1'); const [reason, setReason] = useState(''); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [checking, setChecking] = useState(true); const [activeCertification, setActiveCertification] = useState<ActiveCertification | null>(null); const [message, setMessage] = useState(''); const [error, setError] = useState('')
  const loadCertification = async () => { setChecking(true); const { data, error: queryError } = await supabase.functions.invoke('admin-gift-certification', { body: { action: 'check', userId } }); if (queryError || !data?.success) setError(queryError?.message ?? data?.message ?? 'Impossible de vérifier l’éligibilité.'); else setActiveCertification(data.activeCertification ?? null); setChecking(false) }
  useEffect(() => { void loadCertification() }, [userId])
  const blocked = Boolean(activeCertification?.expires_at && new Date(activeCertification.expires_at).getTime() > Date.now())
  const submit = async () => { if (blocked) { setError(`Certification déjà active jusqu'au ${formatExpiry(activeCertification?.expires_at)}.`); return }; setBusy(true); setError(''); setMessage(''); const { data, error: invokeError } = await supabase.functions.invoke('admin-gift-certification', { body: { userId, certificationCode: code, durationMonths: Number(months), reason: reason.trim() || null } }); if (invokeError || !data?.success) { setError(invokeError?.message ?? data?.message ?? 'Impossible d’offrir la certification.'); setBusy(false); return }; setOpen(false); setReason(''); setMessage(`Certification ${labels[code]} offerte pour ${months} mois.`); await loadCertification(); await onDone(); setBusy(false) }
  return <Card title="Certification" className="certification-offer-card">
    <div className="certification-offer-intro">
      <span className="certification-offer-icon" aria-hidden="true">✓</span>
      <div className="certification-offer-copy"><span className="certification-offer-eyebrow">AVANTAGE COMPTE</span><strong>Offrir une certification</strong><p>Attribuez gratuitement un niveau de certification à ce membre. Réservé aux Super Admins, avec une seule certification active à la fois.</p></div>
    </div>
    <div className="certification-offer-body">
      {checking ? <div className="certification-offer-state"><span className="certification-offer-spinner" aria-hidden="true"/><div><strong>Vérification en cours</strong><small>Nous vérifions si ce membre possède déjà une certification active.</small></div></div>
      : blocked ? <div className="certification-offer-state certification-offer-state-blocked"><span className="certification-offer-state-icon" aria-hidden="true">!</span><div><strong>Certification déjà active</strong><small>Cette certification expire le {formatExpiry(activeCertification?.expires_at)}. Une nouvelle attribution sera possible après expiration.</small></div></div>
      : <div className="certification-offer-ready"><div><strong>Ce membre est éligible</strong><small>Choisissez le niveau et la durée de l’avantage.</small></div><ScroleButton onClick={() => { setError(''); setOpen(true) }}>Offrir une certification</ScroleButton></div>}
      {message && <p className="toast-message" role="status">{message}</p>}{error && <p className="error-message" role="alert">{error}</p>}
    </div>
    {open && <Modal title="Offrir une certification" onClose={() => !busy && setOpen(false)} confirmLabel={busy ? 'Attribution…' : 'Offrir'} onConfirm={() => void submit()}>
      <div className="certification-offer-summary"><strong>Attribution gratuite</strong><span>Durée maximale : 2 mois</span></div>
      <div className="form-field"><span>Certification</span><select value={code} onChange={(event) => setCode(event.target.value as Code)} disabled={busy}><option value="basique">Basique</option><option value="pro">Pro</option><option value="premium">Premium</option></select></div>
      <div className="form-field"><span>Durée</span><select value={months} onChange={(event) => setMonths(event.target.value)} disabled={busy}><option value="1">1 mois</option><option value="2">2 mois</option></select></div>
      <label className="form-field"><span>Motif (optionnel)</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Pourquoi cette certification est-elle offerte ?" disabled={busy}/></label>
    </Modal>}
  </Card>
}

import { useCallback, useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { activityValidationService } from '../../services/activityValidationService'
import { activityValidationRepository, type PendingActivity } from '../../repositories/activityValidationRepository'
import { useAuth } from '../../hooks/useAuth'

function creatorName(activity: PendingActivity) {
  const fullName = [activity.creator?.first_name, activity.creator?.last_name].filter(Boolean).join(' ')
  return fullName || (activity.creator?.username ? `@${activity.creator.username}` : 'Créateur inconnu')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ActivityValidationPage() {
  const { user } = useAuth()
  const [activities, setActivities] = useState<PendingActivity[]>([])
  const [filter, setFilter] = useState<'all' | 'en_attente' | 'active' | 'rejected' | 'deleted'>('all')
  const [selected, setSelected] = useState<PendingActivity | null>(null)
  const [rejecting, setRejecting] = useState<PendingActivity | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const visibleActivities = filter === 'all' ? activities : activities.filter(item => item.status === filter)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setActivities(await activityValidationRepository.listAll()) }
    catch (err) { setError(err instanceof Error ? err.message : 'Impossible de charger les activités en attente.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const validate = async (activity: PendingActivity) => {
    if (processing) return
    setProcessing(true); setError('')
    try {
      await activityValidationService.validate(activity.id)
      setSelected(null)
      setActivities(current => current.filter(item => item.id !== activity.id))
      setMessage('Activité validée. Le créateur sera notifié.')
    } catch (err) { setError(err instanceof Error ? err.message : 'La validation a échoué.') }
    finally { setProcessing(false) }
  }

  const reject = async () => {
    if (!rejecting || processing || !reason.trim()) return
    setProcessing(true); setError('')
    try {
      await activityValidationService.reject(rejecting.id, reason)
      setRejecting(null); setReason('')
      setActivities(current => current.filter(item => item.id !== rejecting.id))
      setMessage('Activité rejetée. Le créateur recevra la raison du refus.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Le rejet a échoué.') }
    finally { setProcessing(false) }
  }

  if (!user || (user.role !== 'Admin' && user.role !== 'Super Admin')) {
    return <Card><div className="table-empty"><strong>Accès réservé</strong><p>La validation des activités est réservée aux administrateurs.</p></div></Card>
  }

  return <>
    <header className="admin-page-header">
      <div><h1>Activités à valider</h1><p>Examinez les activités créées par la communauté avant leur publication.</p></div>
      <div className="admin-page-actions"><StatusBadge tone={activities.filter(a => a.status === 'en_attente').length ? 'warning' : 'success'}>{activities.filter(a => a.status === 'en_attente').length} en attente</StatusBadge><ScroleButton variant="secondary" onClick={() => void load()} disabled={loading}>Actualiser</ScroleButton></div>
    </header>
    {message && <div className="toast-message" role="status">{message}</div>}
    {error && <div className="toast-message" role="alert">{error}</div>}
    <div className="admin-page-actions" style={{ marginBottom: 12 }}><button type="button" className="table-action" onClick={() => setFilter('all')}>Toutes ({activities.length})</button><button type="button" className="table-action" onClick={() => setFilter('en_attente')}>En attente ({activities.filter(a => a.status === 'en_attente').length})</button><button type="button" className="table-action" onClick={() => setFilter('active')}>Actives ({activities.filter(a => a.status === 'active').length})</button><button type="button" className="table-action" onClick={() => setFilter('rejected')}>Rejetées ({activities.filter(a => a.status === 'rejected').length})</button><button type="button" className="table-action" onClick={() => setFilter('deleted')}>Supprimées ({activities.filter(a => a.status === 'deleted').length})</button></div>
    <Card className="resource-card">
      {loading ? <div className="table-empty">Chargement des activités…</div> : visibleActivities.length === 0 ? <div className="table-empty"><strong>Aucune activité à valider</strong><p>Les nouvelles activités apparaîtront ici lorsqu'elles seront soumises.</p></div> :
        <div className="table-scroll"><table className="admin-table"><thead><tr><th>Activité</th><th>Créateur</th><th>Prix de base</th><th>Type</th><th>Créée le</th><th>Action</th></tr></thead><tbody>
          {visibleActivities.map(activity => <tr key={activity.id}>
            <td><strong>{activity.name}</strong><small>{activity.id}</small></td>
            <td><strong>{creatorName(activity)}</strong><small>{activity.creator?.username ? `@${activity.creator.username}` : activity.creator_id}</small></td>
            <td>{activity.base_price.toLocaleString('fr-FR')} FCFA</td>
            <td>{activity.event_only ? 'Événement uniquement' : 'Activité publique'}</td>
            <td>{formatDate(activity.created_at)}</td>
            <td>{activity.status === 'en_attente' ? <button type="button" className="table-action" onClick={() => setSelected(activity)}>Examiner</button> : <StatusBadge tone={activity.status === 'active' ? 'success' : activity.status === 'rejected' ? 'danger' : 'neutral'}>{activity.status}</StatusBadge>}</td>
          </tr>)}
        </tbody></table></div>}
    </Card>
    {selected && <Modal title="Examiner l’activité" onClose={() => setSelected(null)} confirmLabel="Valider l’activité" onConfirm={() => void validate(selected)}>
      <div className="detail-list"><div><span>Nom</span><strong>{selected.name}</strong></div><div><span>Créateur</span><strong>{creatorName(selected)}</strong></div><div><span>Prix de base</span><strong>{selected.base_price.toLocaleString('fr-FR')} FCFA</strong></div><div><span>Usage</span><strong>{selected.event_only ? 'Uniquement dans les événements' : 'Disponible comme activité publique'}</strong></div><div><span>Soumise le</span><strong>{formatDate(selected.created_at)}</strong></div><div><span>Statut</span><StatusBadge tone="warning">En attente</StatusBadge></div></div>
      <p>Après validation, l’activité passe à <strong>active</strong> et le créateur reçoit une notification.</p>
      {processing && <p>Traitement en cours…</p>}
      <button type="button" className="table-action" disabled={processing} onClick={() => { setSelected(null); setRejecting(selected) }}>Rejeter l’activité</button>
    </Modal>}
    {rejecting && <Modal title="Rejeter l’activité" onClose={() => { if (!processing) { setRejecting(null); setReason('') } }} confirmLabel="Rejeter" danger onConfirm={() => void reject()}>
      <p>Indiquez la raison qui sera communiquée au créateur.</p><textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Ex. Cette activité ne respecte pas les règles de la plateforme." rows={5} autoFocus />
      {processing && <p>Traitement en cours…</p>}
    </Modal>}
  </>
}

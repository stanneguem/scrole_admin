import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../hooks/useAuth'
import { Card } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { supabase } from '../../lib/supabase'

type EventDetail = {
  id: string; name: string | null; slug: string | null; description: string | null; photo: string | null
  creator_id: string | null; starts_at: string | null; ends_at: string | null; status: string | null
  is_public: boolean | null; is_free: boolean | null; address: string | null; is_virtual: boolean | null
  virtual_link: string | null; scheduled_deletion_at: string | null; created_at: string | null
  updated_at: string | null; real_created_at: string | null; share_count: number | null
  city?: { nom?: string | null } | null; country?: { nom?: string | null; code_iso?: string | null } | null
  community?: { id?: string; name?: string | null } | null
  creator?: { user_id?: string; username?: string | null; name?: string | null; photo_url?: string | null } | null
  participant_count?: number; checked_in_count?: number
}
type OwnerInfo = { ownership_type: 'platform'|'third_party'; ownership_status: string; ownership_note?: string|null; claimed_owner?: {user_id:string;username?:string|null;first_name?:string|null;last_name?:string|null}|null }
type OwnerCandidate = { user_id:string; username?:string|null; first_name?:string|null; last_name?:string|null; photo_url?:string|null }
type ResponsePayload = { success?: boolean; events?: EventDetail[]; message?: string }

const dateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' }) : 'Non précisée'
const dateOnly = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'medium' }) : 'Non précisée'
const tone = (value: string | null | undefined): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
  const status = (value ?? '').toLowerCase()
  if (['active', 'published', 'actif', 'approved'].includes(status)) return 'success'
  if (['cancelled', 'canceled', 'rejected', 'deleted', 'supprimé'].includes(status)) return 'danger'
  if (['pending', 'draft', 'en attente', 'en_attente'].includes(status)) return 'warning'
  if (['rejected', 'cancelled', 'canceled', 'deleted', 'supprimé'].includes(status)) return 'danger'
  return 'info'
}

export function EventDetailPage({ eventId, onNavigate }: { eventId: string; onNavigate: (path: string) => void }) {
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [action, setAction] = useState<'approve' | 'reject' | 'cancel' | 'suspend' | 'restore' | 'delete' | null>(null)
  const [reason, setReason] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [ownership,setOwnership]=useState<OwnerInfo|null>(null)
  const [ownerQuery,setOwnerQuery]=useState(''); const [ownerCandidates,setOwnerCandidates]=useState<OwnerCandidate[]>([])
  const [selectedOwner,setSelectedOwner]=useState<OwnerCandidate|null>(null); const [proofNote,setProofNote]=useState(''); const [transferBusy,setTransferBusy]=useState(false)
  const { hasPermission } = useAuth()

  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    supabase.functions.invoke('admin-events-directory', { body: {} })
      .then(({ data, error: invokeError }) => {
        if (invokeError) throw invokeError
        const payload = data as ResponsePayload | null
        if (payload?.success === false) throw new Error(payload.message || 'Impossible de charger les événements.')
        const found = (payload?.events ?? []).find((row) => String(row.id) === eventId)
        if (active) {
          setEvent(found ?? null)
          if (!found) setError('Cet événement est introuvable ou ne figure pas dans la liste accessible.')
        }
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Erreur lors du chargement des détails.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [eventId, reload])

  useEffect(()=>{let active=true;supabase.functions.invoke('admin-event-ownership-info',{body:{eventId}}).then(({data,error})=>{if(!active)return;if(!error&&data?.success)setOwnership(data.ownership??null)});return()=>{active=false}},[eventId,reload])
  useEffect(()=>{let active=true;const q=ownerQuery.trim();if(q.length<2){setOwnerCandidates([]);return}const timer=window.setTimeout(()=>{void supabase.functions.invoke('admin-user-directory',{body:{action:'search',query:q}}).then(({data,error})=>{if(!active)return;setOwnerCandidates(!error&&data?.success?(data.users??[]) as OwnerCandidate[]:[])})},250);return()=>{active=false;window.clearTimeout(timer)}},[ownerQuery])
  const transferOwnership=async()=>{if(!event||!selectedOwner||!proofNote.trim()||transferBusy)return;setTransferBusy(true);setNotice(null);try{const {data,error}=await supabase.functions.invoke('admin-event-ownership-transfer',{body:{eventId:event.id,userId:selectedOwner.user_id,proofNote:proofNote.trim()}});if(error)throw error;if(!data?.success)throw new Error(data?.message||'Transfert impossible.');setNotice({kind:'success',text:'Propriété transférée au propriétaire vérifié.'});setSelectedOwner(null);setOwnerQuery('');setProofNote('');setReload(v=>v+1)}catch(e){setNotice({kind:'error',text:e instanceof Error?e.message:'Transfert impossible.'})}finally{setTransferBusy(false)}}
  const place = event ? [event.address, event.city?.nom, event.country?.nom].filter(Boolean).join(', ') : ''
  const creator = event?.creator?.name || event?.creator?.username || 'Organisateur inconnu'
  const canApprove = hasPermission('events.approve')
  const canReject = hasPermission('events.reject')
  const canSuspend = hasPermission('events.suspend')
  const canRestore = hasPermission('events.restore')
  const canDelete = hasPermission('events.delete')
  const pending = event?.status === 'en_attente'
  const actionLabels = { approve: 'Valider l’événement', reject: 'Refuser l’événement', cancel: 'Annuler l’événement', suspend: 'Suspendre l’événement', restore: 'Restaurer l’événement', delete: 'Supprimer définitivement l’événement' } as const
  const actionDescriptions = {
    approve: 'L’événement sera validé et rendu public.',
    reject: 'L’événement sera refusé et restera non public.',
    cancel: 'L’événement sera annulé et ne sera plus public.',
    suspend: 'L’événement sera retiré de la visibilité publique et marqué pour suppression.',
    restore: 'L’événement sera réactivé et retiré de la suppression programmée.',
    delete: 'L’événement sera marqué supprimé et ne sera plus public. Cette action est réservée aux rôles disposant de la permission de suppression.',
  } as const
  const runModeration = async () => {
    if (!event || !action || !reason.trim()) { setNotice({ kind: 'error', text: 'Un motif est obligatoire pour tracer cette décision.' }); return }
    setActionBusy(true); setNotice(null)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-event-moderation', { body: { eventId: event.id, action, reason: reason.trim() } })
      if (invokeError) throw invokeError
      if (!data?.success) throw new Error(data?.message || 'L’action de modération a échoué.')
      setNotice({ kind: 'success', text: actionLabels[action] + ' : action enregistrée.' })
      setAction(null); setReason(''); setReload((value) => value + 1)
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Impossible d’exécuter cette action.' })
    } finally { setActionBusy(false) }
  }

  return <>
    <header className="admin-page-header">
      <div><button type="button" className="back-action" onClick={() => onNavigate('/admin/events')}>← Retour aux événements</button><h1>{event?.name || 'Détails de l’événement'}</h1><p>{event?.id || eventId}{event?.slug ? ' · ' + event.slug : ''}</p></div>
      <div className="admin-page-actions"><button type="button" className="pagination-button" onClick={() => setReload((value) => value + 1)}>↻ Actualiser</button></div>
    </header>
    {notice && <div className={notice.kind === 'success' ? 'toast-message' : 'table-empty'} role="status">{notice.text}</div>}
    {loading && <Card><div className="table-empty">Chargement des détails de l’événement…</div></Card>}
    {!loading && error && <Card><div className="table-empty"><strong>{event ? 'Attention' : 'Événement indisponible'}</strong><p>{error}</p><button type="button" className="table-action" onClick={() => setReload((value) => value + 1)}>Réessayer</button><button type="button" className="table-action" onClick={() => onNavigate('/admin/events')}>Retour à la liste</button></div></Card>}
    {!loading && event && <>
      {event.photo && <div className="entity-inspector-hero"><div className="entity-cover" style={{ backgroundImage: 'url(' + JSON.stringify(event.photo).slice(1, -1) + ')' }} /><div className="entity-hero-copy"><div><span className="auth-eyebrow">Événement Scrole</span><h2>{event.name || event.slug || 'Événement sans nom'}</h2><p>{event.description || 'Aucune description renseignée.'}</p></div><StatusBadge tone={tone(event.status)}>{event.status || 'Statut non précisé'}</StatusBadge></div></div>}
      <Card title="Modération de l’événement"><div className="event-moderation-panel">
        {pending && canApprove && <button type="button" className="scrole-button scrole-button-primary" onClick={() => { setAction('approve'); setReason('') }}>Valider l’événement</button>}
        {pending && canReject && <button type="button" className="scrole-button scrole-button-danger" onClick={() => { setAction('reject'); setReason('') }}>Refuser</button>}
        {event.status === 'active' && canSuspend && <button type="button" className="scrole-button scrole-button-secondary" onClick={() => { setAction('cancel'); setReason('') }}>Annuler l’événement</button>}
        {event.status === 'active' && canSuspend && <button type="button" className="scrole-button scrole-button-secondary" onClick={() => { setAction('suspend'); setReason('') }}>Suspendre / retirer du public</button>}
        {['pending_deletion', 'rejected'].includes(event.status || '') && canRestore && <button type="button" className="scrole-button scrole-button-primary" onClick={() => { setAction('restore'); setReason('') }}>Restaurer</button>}
        {event.status !== 'deleted' && canDelete && <button type="button" className="scrole-button scrole-button-danger" onClick={() => { setAction('delete'); setReason('') }}>Supprimer</button>}
        {!((pending && (canApprove || canReject)) || (event.status === 'active' && canSuspend) || (['pending_deletion', 'rejected'].includes(event.status || '') && canRestore) || (event.status !== 'deleted' && canDelete)) && <p>Aucune action disponible pour votre rôle et le statut actuel de cet événement.</p>}
        <p className="event-moderation-help">Chaque décision exige un motif et est inscrite dans l’historique d’audit.</p>
      </div></Card>
      <div className="detail-grid">
        <Card title="Informations générales"><div className="detail-list">
          <div><span>Statut</span><StatusBadge tone={tone(event.status)}>{event.status || 'Non précisé'}</StatusBadge></div>
          <div><span>Visibilité</span><strong>{event.is_public ? 'Public' : 'Privé'}</strong></div>
          <div><span>Tarif</span><strong>{event.is_free ? 'Gratuit' : 'Payant / non précisé'}</strong></div>
          <div><span>Format</span><strong>{event.is_virtual ? 'En ligne' : 'Présentiel'}</strong></div>
          <div><span>Identifiant</span><strong>{event.id}</strong></div>
          <div><span>Slug</span><strong>{event.slug || 'Non renseigné'}</strong></div>
        </div></Card>
        <Card title="Dates et lieu"><div className="detail-list">
          <div><span>Début</span><strong>{dateTime(event.starts_at)}</strong></div>
          <div><span>Fin</span><strong>{dateTime(event.ends_at)}</strong></div>
          <div><span>Adresse</span><strong>{place || (event.is_virtual ? 'Événement en ligne' : 'Lieu non renseigné')}</strong></div>
          {event.virtual_link && <div><span>Lien en ligne</span><a href={event.virtual_link} target="_blank" rel="noreferrer">Ouvrir le lien</a></div>}
          <div><span>Pays</span><strong>{event.country?.nom || 'Non renseigné'}</strong></div>
          <div><span>Ville</span><strong>{event.city?.nom || 'Non renseignée'}</strong></div>
        </div></Card>
        <Card title="Organisateur"><div className="detail-list">
          <div><span>Nom</span><strong>{creator}</strong></div>
          <div><span>Nom d’utilisateur</span><strong>{event.creator?.username ? '@' + event.creator.username : 'Non renseigné'}</strong></div>
          <div><span>ID utilisateur</span><strong>{event.creator?.user_id || event.creator_id || 'Non renseigné'}</strong></div>
          <div><span>Communauté</span><strong>{event.community?.name || 'Aucune communauté liée'}</strong></div>
        </div></Card>
        <Card title="Propriété de l’événement"><div className="detail-list">
          <div><span>Origine</span><strong>{ownership?.ownership_type==='third_party'?'Événement d’un tiers':'Événement Scrole'}</strong></div>
          <div><span>État de propriété</span><strong>{ownership?.ownership_status==='transferred'?'Propriété transférée':ownership?.ownership_status==='awaiting_proof'?'En attente de preuve':'Propriété Scrole'}</strong></div>
          {ownership?.ownership_note&&<div><span>Note de création</span><strong>{ownership.ownership_note}</strong></div>}
          {ownership?.claimed_owner&&<div><span>Propriétaire actuel</span><strong>{[ownership.claimed_owner.first_name,ownership.claimed_owner.last_name].filter(Boolean).join(' ')||'@'+ownership.claimed_owner.username}</strong></div>}
        </div>
        {ownership?.ownership_type==='third_party'&&ownership.ownership_status!=='transferred'&&hasPermission('events.transfer_ownership')&&<div className="event-owner-transfer">
          <h3>Transférer la propriété</h3><p>Après vérification des justificatifs du propriétaire, recherchez son compte puis confirmez le transfert. Son compte deviendra le créateur officiel de l’événement.</p>
          <label className="search-field"><span>⌕</span><input value={ownerQuery} onChange={e=>{setOwnerQuery(e.target.value);setSelectedOwner(null)}} placeholder="Rechercher par nom ou pseudo du propriétaire"/></label>
          {ownerCandidates.length>0&&<div className="event-owner-results">{ownerCandidates.map(candidate=><button type="button" key={candidate.user_id} onClick={()=>{setSelectedOwner(candidate);setOwnerQuery('@'+(candidate.username??candidate.user_id));setOwnerCandidates([])}}><strong>{[candidate.first_name,candidate.last_name].filter(Boolean).join(' ')||candidate.username}</strong><small>@{candidate.username??'sans pseudo'} · {candidate.user_id}</small></button>)}</div>}
          {selectedOwner&&<div className="event-owner-selected">Compte sélectionné : <strong>@{selectedOwner.username??selectedOwner.user_id}</strong></div>}
          <label className="decision-form">Preuve vérifiée / référence du justificatif<textarea value={proofNote} onChange={e=>setProofNote(e.target.value)} rows={3} placeholder="Décrivez la preuve vérifiée et la décision administrative…"/></label>
          <button type="button" className="scrole-button scrole-button-primary" disabled={!selectedOwner||!proofNote.trim()||transferBusy} onClick={()=>void transferOwnership()}>{transferBusy?'Transfert…':'Confirmer le transfert de propriété'}</button>
        </div>}
        </Card>
        <Card title="Participation"><div className="detail-list">
          <div><span>Participants inscrits</span><strong>{event.participant_count ?? 0}</strong></div>
          <div><span>Présences validées</span><strong>{event.checked_in_count ?? 0}</strong></div>
          <div><span>Partages</span><strong>{event.share_count ?? 0}</strong></div>
        </div></Card>
        <Card title="Description"><div className="context-content"><p>{event.description || 'Aucune description renseignée pour cet événement.'}</p></div></Card>
        <Card title="Dates de suivi"><div className="detail-list">
          <div><span>Création</span><strong>{dateTime(event.real_created_at || event.created_at)}</strong></div>
          <div><span>Dernière mise à jour</span><strong>{dateTime(event.updated_at)}</strong></div>
          <div><span>Suppression programmée</span><strong>{dateTime(event.scheduled_deletion_at)}</strong></div>
        </div></Card>
      </div>
    </>}
    {action && <Modal title={actionLabels[action]} onClose={() => { if (!actionBusy) { setAction(null); setReason('') } }} confirmLabel={actionBusy ? 'Traitement…' : 'Confirmer la décision'} danger={action === 'delete' || action === 'reject' || action === 'cancel'} onConfirm={() => void runModeration()}>
      <p>{actionDescriptions[action]}</p>
      <label className="decision-form">Motif obligatoire<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={2000} placeholder="Expliquez la décision de modération…" /></label>
      {!reason.trim() && <small>Ajoutez un motif avant de confirmer.</small>}
    </Modal>}
  </>
}

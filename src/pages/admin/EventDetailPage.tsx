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
  creator?: { user_id?: string; username?: string | null; name?: string | null; photo_url?: string | null; is_admin_creator?: boolean; admin_role?: string | null } | null
  participant_count?: number; checked_in_count?: number
}
type OwnerInfo = { ownership_type: 'platform'|'third_party'; ownership_status: string; ownership_note?: string|null; claimed_owner?: {user_id:string;username?:string|null;first_name?:string|null;last_name?:string|null}|null }
type OwnerCandidate = { user_id:string; username?:string|null; first_name?:string|null; last_name?:string|null; photo_url?:string|null }
type ResponsePayload = { success?: boolean; events?: EventDetail[]; message?: string }

const dateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' }) : 'Non précisée'
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
  const [ownershipLoading,setOwnershipLoading]=useState(true)
  const [ownershipError,setOwnershipError]=useState('')
  const [ownerQuery,setOwnerQuery]=useState(''); const [ownerCandidates,setOwnerCandidates]=useState<OwnerCandidate[]>([])
  const [selectedOwner,setSelectedOwner]=useState<OwnerCandidate|null>(null); const [proofNote,setProofNote]=useState(''); const [transferBusy,setTransferBusy]=useState(false)
  const [transferPageOpen,setTransferPageOpen]=useState(false)
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

  useEffect(() => {
    let active = true
    setOwnership(null)
    setOwnershipLoading(true)
    setOwnershipError('')
    supabase.functions.invoke('admin-event-ownership-info', { body: { eventId } })
      .then(({ data, error: invokeError }) => {
        if (invokeError) throw invokeError
        if (!data?.success) throw new Error(data?.message || 'Impossible de charger les informations de propriété.')
        if (active) setOwnership(data.ownership ?? null)
      })
      .catch((reason: unknown) => {
        if (active) setOwnershipError(reason instanceof Error ? reason.message : 'Erreur de chargement de la propriété.')
      })
      .finally(() => { if (active) setOwnershipLoading(false) })
    return () => { active = false }
  }, [eventId, reload])
  useEffect(()=>{let active=true;const q=ownerQuery.trim();if(q.length<2){setOwnerCandidates([]);return}const timer=window.setTimeout(()=>{void supabase.functions.invoke('admin-event-owner-search',{body:{query:q}}).then(({data,error})=>{if(!active)return;setOwnerCandidates(!error&&data?.success?(data.users??[]) as OwnerCandidate[]:[])})},250);return()=>{active=false;window.clearTimeout(timer)}},[ownerQuery])
  const transferOwnership=async()=>{if(!event||!selectedOwner||!proofNote.trim()||transferBusy)return;setTransferBusy(true);setNotice(null);try{const {data,error}=await supabase.functions.invoke('admin-event-ownership-transfer',{body:{eventId:event.id,userId:selectedOwner.user_id,proofNote:proofNote.trim()}});if(error)throw error;if(!data?.success)throw new Error(data?.message||'Transfert impossible.');setNotice({kind:'success',text:'Propriété transférée au propriétaire vérifié.'});setSelectedOwner(null);setOwnerQuery('');setProofNote('');setTransferPageOpen(false);setReload(v=>v+1)}catch(e){setNotice({kind:'error',text:e instanceof Error?e.message:'Transfert impossible.'})}finally{setTransferBusy(false)}}
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
  if (transferPageOpen && event) {
    return <>
      <header className="admin-page-header">
        <div>
          <button type="button" className="back-action" onClick={() => setTransferPageOpen(false)}>← Retour aux détails</button>
          <h1>Transférer la propriété</h1>
          <p>{event.name || event.slug || 'Événement'} · Sélection du nouveau propriétaire</p>
        </div>
      </header>
      <Card title="Rechercher un membre">
        <p>Recherchez le compte de la personne qui a prouvé être propriétaire de cet événement. Sélectionnez son profil, ajoutez la référence de la preuve vérifiée, puis confirmez le transfert.</p>
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            autoComplete="off"
            value={ownerQuery}
            onChange={e => { setOwnerQuery(e.target.value); setSelectedOwner(null) }}
            placeholder="Rechercher par nom, prénom ou pseudonyme…"
            aria-label="Rechercher un membre"
          />
        </label>
        {ownerQuery.trim().length < 2 && !selectedOwner && <div className="table-empty">Saisissez au moins deux caractères pour rechercher un membre.</div>}
        {ownerQuery.trim().length >= 2 && ownerCandidates.length === 0 && !selectedOwner && <div className="table-empty">Aucun membre trouvé. Essayez un autre nom ou pseudonyme.</div>}
        {ownerCandidates.length > 0 && <div className="event-owner-results">
          {ownerCandidates.map(candidate => (
            <button type="button" key={candidate.user_id} onClick={() => {
              setSelectedOwner(candidate);
              setOwnerQuery([candidate.first_name, candidate.last_name].filter(Boolean).join(' ') || (candidate.username ? '@' + candidate.username : candidate.user_id));
              setOwnerCandidates([]);
            }}>
              <strong>{[candidate.first_name, candidate.last_name].filter(Boolean).join(' ') || candidate.username || 'Membre Scrole'}</strong>
              <small>{candidate.username ? '@' + candidate.username : 'Sans pseudonyme'} · {candidate.user_id}</small>
            </button>
          ))}
        </div>}
        {selectedOwner && <div className="event-owner-selected">
          <strong>Membre sélectionné</strong>
          <div>{[selectedOwner.first_name, selectedOwner.last_name].filter(Boolean).join(' ') || 'Membre Scrole'}</div>
          <small>{selectedOwner.username ? '@' + selectedOwner.username : selectedOwner.user_id}</small>
          <button type="button" className="table-action" onClick={() => { setSelectedOwner(null); setOwnerQuery('') }}>Changer de membre</button>
        </div>}
        <label className="decision-form">
          Preuve vérifiée / référence du justificatif
          <textarea value={proofNote} onChange={e => setProofNote(e.target.value)} rows={4} maxLength={2000} placeholder="Indiquez le justificatif examiné et pourquoi il confirme la propriété de cet événement…" />
        </label>
        <div className="admin-page-actions">
          <button type="button" className="scrole-button scrole-button-secondary" onClick={() => setTransferPageOpen(false)}>Annuler</button>
          <button type="button" className="scrole-button scrole-button-primary" disabled={!selectedOwner || !proofNote.trim() || transferBusy} onClick={() => void transferOwnership()}>
            {transferBusy ? 'Transfert en cours…' : 'Valider le transfert de propriété'}
          </button>
        </div>
      </Card>
    </>;
  }

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
          <div><span>{event.creator?.is_admin_creator ? 'Compte' : 'Nom d’utilisateur'}</span><strong>{event.creator?.is_admin_creator ? 'Administrateur Scrole' : event.creator?.username ? '@' + event.creator.username : 'Non renseigné'}</strong></div>
          {event.creator?.is_admin_creator && <div><span>Rôle administratif</span><strong>{event.creator.admin_role === 'super_admin' ? 'Super administrateur' : 'Administrateur'}</strong></div>}
          <div><span>ID utilisateur</span><strong>{event.creator?.user_id || event.creator_id || 'Non renseigné'}</strong></div>
          <div><span>Communauté</span><strong>{event.community?.name || 'Aucune communauté liée'}</strong></div>
        </div></Card>
        <Card title="Propriété de l’événement"><div className="detail-list">
          <div><span>Origine</span><strong>{ownershipLoading?'Chargement…':ownershipError?'Indisponible':ownership?.ownership_type==='third_party'?'Événement d’un tiers':ownership?.ownership_type==='platform'?'Événement Scrole':'Non renseignée'}</strong></div>
          <div><span>État de propriété</span><strong>{ownershipLoading?'Chargement…':ownershipError?'Indisponible':ownership?.ownership_status==='transferred'?'Propriété transférée':ownership?.ownership_status==='awaiting_proof'?'En attente de preuve':ownership?.ownership_status||'Non renseigné'}</strong></div>
          {ownership?.ownership_note&&<div><span>Note de création</span><strong>{ownership.ownership_note}</strong></div>}
          {ownership?.claimed_owner&&<div><span>Propriétaire actuel</span><strong>{[ownership.claimed_owner.first_name,ownership.claimed_owner.last_name].filter(Boolean).join(' ')||'@'+ownership.claimed_owner.username}</strong></div>}
        </div>
        {ownershipError&&<p className="event-moderation-help">Impossible de charger la propriété : {ownershipError}</p>}
        {ownership?.ownership_type==='third_party'&&ownership.ownership_status!=='transferred'&&<div className="event-owner-transfer">
          <h3>Réattribuer la propriété</h3>
          <p>Cet événement appartient à un tiers. Après vérification de ses justificatifs, vous pouvez sélectionner son compte Scrole et lui transférer officiellement la propriété.</p>
          <button type="button" className="scrole-button scrole-button-primary" onClick={() => { setOwnerQuery(''); setOwnerCandidates([]); setSelectedOwner(null); setProofNote(''); setTransferPageOpen(true) }}>
            Rechercher le propriétaire et transférer
          </button>
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

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { ReportReviewScreen } from './ReportReviewScreen'

export type Report = {
  id: string
  source?: 'signalement' | 'external_profile'
  target_type: string
  target_id: string
  status: string
  created_at: string
  reports_count?: number
  description: string | null
  escalated: boolean
  from_community: boolean
  community_id: string | null
  community?: { id: string; name: string } | null
  reason?: { code?: string; nom?: string } | null
  reporter?: { username?: string; first_name?: string; last_name?: string } | null
  target?: {
    user_id?: string
    username?: string
    first_name?: string
    last_name?: string
    content?: string
    post_id?: string
    community_id?: string
    status?: string
    name?: string
    description?: string
    bio?: string
    photo_url?: string
    cover_url?: string
    photo_profile?: string
    photo_cover?: string
    creator?: { user_id?: string; username?: string; first_name?: string; last_name?: string; photo_url?: string }
    photo?: string
    photos?: string[]
    image_url?: string
    thumbnail_url?: string
    reputation_score?: number
    account_status?: string
    media?: { type?: string; url?: string; thumbnail_url?: string }[]
    kind?: string
    created_at?: string
    video_url?: string
    video_thumbnail_url?: string
    post?: { id?: string; content?: string; community_id?: string }
    shared_post_snapshot?: unknown
    videos?: ({url?: string; thumbnail_url?: string} | string)[]
    author?: { user_id?: string; username?: string; first_name?: string; last_name?: string; photo_url?: string }
  } | null
}

type Props = { onNavigate: (path: string) => void }
type StatusFilter = 'open' | 'handled' | 'all'

const labelType = (type: string) => ({ post: 'Publication', comment: 'Commentaire', story: 'Story', user: 'Profil', profile: 'Profil', community: 'Communauté' }[type] ?? type)
const labelStatus = (status: string) => ({ en_attente: 'En attente', en_cours: 'En cours', resolu: 'Résolu', rejete: 'Rejeté', pending: 'En attente', reviewing: 'En cours', resolved: 'Résolu', dismissed: 'Rejeté' }[status] ?? status)
const displayName = (person?: { username?: string; first_name?: string; last_name?: string } | null) => {
  if (!person) return 'Compte indisponible'
  const name = [person.first_name, person.last_name].filter(Boolean).join(' ').trim()
  return name || (person.username ? `@${person.username}` : 'Compte indisponible')
}
const formatDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function PlatformReportsPage({ onNavigate }: Props) {
  const { hasPermission } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [status, setStatus] = useState<StatusFilter>('open')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<Report | null>(null)
  const [decision, setDecision] = useState<'dismiss' | 'remove_content' | 'shadowban' | 'suspend_user' | 'suspend_community'>('dismiss')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('get_platform_reports', {
        p_status: status,
        p_limit: 50,
        p_offset: offset,
      })
      if (rpcError) throw rpcError
      const payload = data as { items?: Report[]; profile_items?: Report[]; has_more?: boolean } | null
      const merged = [...(payload?.items ?? []), ...(offset === 0 ? (payload?.profile_items ?? []) : [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setReports(previous => offset > 0 ? [...previous, ...merged] : merged)
      setHasMore(payload?.has_more === true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les signalements. Vérifiez les droits de votre compte administrateur.')
    } finally {
      setLoading(false)
    }
  }, [status, offset])

  useEffect(() => { void load() }, [load])

  const openDecision = (report: Report, next: typeof decision) => {
    setSelected(report)
    setDecision(next)
    setNote('')
  }

  const submitDecision = async () => {
    if (!selected || busyId) return
    setBusyId(selected.id)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('resolve_platform_report', {
        p_report_id: selected.id,
        p_action: decision,
        p_note: note.trim() || null,
      })
      if (rpcError) throw rpcError
      setSelected(null)
      if (offset === 0) await load()
      else { setOffset(0); setReports([]) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La décision n’a pas pu être enregistrée.')
    } finally {
      setBusyId(null)
    }
  }

  if (selected) return <ReportReviewScreen
    report={selected}
    decision={decision}
    onDecision={setDecision}
    note={note}
    onNote={setNote}
    onBack={() => setSelected(null)}
    onConfirm={() => void submitDecision()}
    busy={busyId === selected.id}
    canDelete={hasPermission('posts.delete')}
    canShadowban={hasPermission('posts.hide')}
    canSuspendUser={hasPermission('users.suspend')}
    canSuspendCommunity={hasPermission('communities.suspend')}
    onNavigate={onNavigate}
  />

  return <>
    <header className="admin-page-header">
      <div><h1>Signalements</h1><p>File des signalements Scrole, y compris les publications signalées depuis les fils de communautés, avec leur contexte pour la modération.</p></div>
      <div className="admin-page-actions"><ScroleButton variant="secondary" onClick={() => void load()}>Actualiser</ScroleButton></div>
    </header>
    <Card className="resource-card">
      <div className="resource-toolbar">
        <label className="search-field"><span aria-hidden="true">▤</span><select value={status} onChange={e => { setStatus(e.target.value as StatusFilter); setOffset(0); setReports([]) }} aria-label="Filtrer les signalements">
          <option value="open">À traiter</option><option value="handled">Traités</option><option value="all">Tous</option>
        </select></label>
        <span className="result-count">{reports.length} signalement{reports.length > 1 ? 's' : ''}</span>
      </div>
      {error && <div className="form-message form-message-error" role="alert">{error}</div>}
      {loading ? <div className="table-empty">Chargement des signalements…</div> : reports.length === 0 ? <div className="table-empty">Aucun signalement dans cette file pour le filtre sélectionné.</div> :
        <div className="table-scroll"><table className="admin-table"><thead><tr><th>Signalement</th><th>Origine</th><th>Cible</th><th>Statut</th><th>Date</th><th>Décision</th></tr></thead><tbody>
          {reports.map(report => <tr key={report.id}>
            <td><strong>{report.reason?.nom ?? 'Motif non précisé'}</strong><small>{report.id}</small>{typeof report.reports_count === 'number' && <small>{report.reports_count} signalement{report.reports_count > 1 ? 's' : ''} ouvert{report.reports_count > 1 ? 's' : ''} sur cette cible</small>}{report.description && <small>{report.description}</small>}</td>
            <td><strong>{report.from_community ? 'Communauté' : report.source === 'external_profile' ? 'Profil externe' : 'Plateforme'}</strong><small>{report.community?.name ?? (report.community_id ? report.community_id : 'Signalement global')}</small>{report.escalated && <small>Escaladé automatiquement · 48 h</small>}</td>
            <td><strong>{labelType(report.target_type)} · {displayName(report.target?.author ?? report.target?.creator ?? report.target)}</strong><small>{report.target?.name ?? report.target?.content ?? report.target_id}</small><button type="button" className="table-action" onClick={() => openDecision(report, 'dismiss')}>Examiner</button></td>
            <td><StatusBadge tone={report.status === 'resolu' ? 'success' : report.status === 'rejete' ? 'danger' : 'warning'}>{labelStatus(report.status)}</StatusBadge></td>
            <td>{formatDate(report.created_at)}</td>
            <td><div className="admin-page-actions">
              {(report.status === 'en_attente' || report.status === 'en_cours') ? <>
                {hasPermission('reports.reject') && <button type="button" className="table-action" onClick={() => openDecision(report, 'dismiss')}>Rejeter</button>}
                {['post', 'comment', 'story'].includes(report.target_type) && hasPermission('reports.resolve') && hasPermission('posts.delete') && <button type="button" className="table-action" onClick={() => openDecision(report, 'remove_content')}>Supprimer le contenu</button>}
                {report.target_type === 'post' && hasPermission('reports.resolve') && hasPermission('posts.hide') && <button type="button" className="table-action" onClick={() => openDecision(report, 'shadowban')}>Shadowban</button>}
                {['user', 'profile'].includes(report.target_type) && hasPermission('users.suspend') && hasPermission('reports.resolve') && <button type="button" className="table-action" onClick={() => openDecision(report, 'suspend_user')}>Suspendre le compte</button>}
                {report.target_type === 'community' && hasPermission('communities.suspend') && hasPermission('reports.resolve') && <button type="button" className="table-action" onClick={() => openDecision(report, 'suspend_community')}>Suspendre la communauté</button>}
              </> : <span>Traité</span>}
              {report.community_id && <button type="button" className="table-action" onClick={() => onNavigate(`/admin/communities/${report.community_id}`)}>Voir communauté</button>}
            </div></td>
          </tr>)}
        </tbody></table></div>}
      {!loading && hasMore && <div className="table-footer"><span>Plus de signalements disponibles</span><button type="button" className="scrole-button scrole-button-secondary" onClick={() => setOffset(current => current + 50)}>Charger les suivants</button></div>}
    </Card>
    {selected && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="report-decision-title">
      <header className="modal-header"><h2 id="report-decision-title">{decision === 'dismiss' ? 'Rejeter le signalement' : decision === 'remove_content' ? 'Supprimer le contenu signalé' : decision === 'shadowban' ? 'Shadowban de la publication' : decision === 'suspend_community' ? 'Suspendre la communauté' : 'Suspendre le compte signalé'}</h2><button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="Fermer">×</button></header>
      <div className="modal-body">
        <p><strong>{selected.reason?.nom ?? 'Signalement'}</strong> · {labelType(selected.target_type)}</p>
        <p>Origine : {selected.community?.name ?? (selected.community_id ?? 'Plateforme')}{selected.escalated ? ' · remonté après 48 heures' : selected.source === 'external_profile' ? ' · signalement de profil externe' : ''}</p>
        <div className="report-review-preview">
          <h3>Contenu / cible à examiner</h3>
          {(selected.target?.photo_url ?? selected.target?.photo_profile) && <img src={(selected.target?.photo_url ?? selected.target?.photo_profile)!} alt="Photo du profil ou de l'auteur" style={{width:88,height:88,objectFit:'cover',borderRadius:12}} />}
          {(selected.target?.cover_url ?? selected.target?.photo_cover) && <img src={(selected.target?.cover_url ?? selected.target?.photo_cover)!} alt="Couverture du profil" style={{width:'100%',maxHeight:150,objectFit:'cover',borderRadius:12}} />}
          {selected.target?.name && <p><strong>{selected.target.name}</strong></p>}
          {selected.target?.content && <p style={{whiteSpace:'pre-wrap'}}>{selected.target.content}</p>}
          {selected.target?.bio && <p style={{whiteSpace:'pre-wrap'}}>{selected.target.bio}</p>}
          {selected.target?.description && <p style={{whiteSpace:'pre-wrap'}}>{selected.target.description}</p>}
          {selected.target?.reputation_score !== undefined && <p>Réputation : {selected.target.reputation_score}</p>}
          {selected.target?.account_status && <p>Statut du compte : {selected.target.account_status}</p>}
          {selected.target?.media?.map((item, index) => item.url && <div key={item.url + index}>{item.type === 'video' ? <a href={item.url} target="_blank" rel="noreferrer">Ouvrir la vidéo {index + 1}</a> : <img src={item.url} alt={'Média ' + (index + 1)} style={{maxWidth:'100%',maxHeight:260,objectFit:'contain',borderRadius:10}} />}</div>)}
          {selected.target?.photos?.map((url, index) => <img key={url + index} src={url} alt={'Photo ' + (index + 1)} style={{maxWidth:'100%',maxHeight:260,objectFit:'contain',borderRadius:10}} />)}
          {selected.target?.photo && <img src={selected.target.photo} alt="Publication signalée" style={{maxWidth:'100%',maxHeight:260,objectFit:'contain',borderRadius:10}} />}
          {selected.target?.image_url && <img src={selected.target.image_url} alt="Story signalée" style={{maxWidth:'100%',maxHeight:260,objectFit:'contain',borderRadius:10}} />}
          {!selected.target && <p>La cible n'est plus disponible. Identifiant : {selected.target_id}</p>}
          {selected.description && <p><strong>Précisions du signalant :</strong> {selected.description}</p>}
        </div>
        {selected.target?.user_id && <button type="button" className="table-action" onClick={() => onNavigate(`/admin/users/${selected.target?.user_id}`)}>Ouvrir le dossier complet du profil</button>}
        {selected.community_id && <button type="button" className="table-action" onClick={() => onNavigate(`/admin/communities/${selected.community_id}`)}>Ouvrir le dossier complet de la communauté</button>}
        <label className="field">Décision
          <select value={decision} onChange={e => setDecision(e.target.value as typeof decision)}>
            <option value="dismiss">Rejeter le signalement</option>
            {['post','comment','story'].includes(selected.target_type) && hasPermission('posts.delete') && <option value="remove_content">Supprimer le contenu</option>}
            {selected.target_type === 'post' && hasPermission('posts.hide') && <option value="shadowban">Shadowban la publication</option>}
            {['user','profile'].includes(selected.target_type) && hasPermission('users.suspend') && <option value="suspend_user">Suspendre le profil</option>}
            {selected.target_type === 'community' && hasPermission('communities.suspend') && <option value="suspend_community">Suspendre la communauté</option>}
          </select>
        </label>
        <label className="field">Note de modération<textarea value={note} onChange={e => setNote(e.target.value)} rows={4} maxLength={1000} placeholder="Motif de la décision (facultatif)" /></label>
      </div>
      <footer className="modal-footer"><button type="button" className="scrole-button scrole-button-secondary" onClick={() => setSelected(null)}>Annuler</button><button type="button" className="scrole-button scrole-button-danger" disabled={busyId === selected.id} onClick={() => void submitDecision()}>{busyId === selected.id ? 'Enregistrement…' : 'Confirmer la décision'}</button></footer>
    </section></div>}
  </>
}

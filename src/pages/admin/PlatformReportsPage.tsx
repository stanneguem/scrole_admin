import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../hooks/useAuth'

type Report = {
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
    author?: { username?: string }
  } | null
}

type Props = { onNavigate: (path: string) => void }
type StatusFilter = 'open' | 'handled' | 'all'

const labelType = (type: string) => ({ post: 'Publication', comment: 'Commentaire', story: 'Story', user: 'Membre' }[type] ?? type)
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
  const [decision, setDecision] = useState<'dismiss' | 'remove_content' | 'suspend_user'>('dismiss')

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
            <td><strong>{labelType(report.target_type)} · {displayName(report.target?.author ?? report.target)}</strong><small>{report.target?.content ?? report.target_id}</small></td>
            <td><StatusBadge tone={report.status === 'resolu' ? 'success' : report.status === 'rejete' ? 'danger' : 'warning'}>{labelStatus(report.status)}</StatusBadge></td>
            <td>{formatDate(report.created_at)}</td>
            <td><div className="admin-page-actions">
              {(report.status === 'en_attente' || report.status === 'en_cours') ? <>
                {hasPermission('reports.reject') && <button type="button" className="table-action" onClick={() => openDecision(report, 'dismiss')}>Rejeter</button>}
                {report.target_type !== 'user' && hasPermission('reports.resolve') && hasPermission('posts.delete') && <button type="button" className="table-action" onClick={() => openDecision(report, 'remove_content')}>Supprimer le contenu</button>}
                {report.target_type === 'user' && (report.escalated || report.source === 'external_profile') && hasPermission('users.suspend') && hasPermission('reports.resolve') && <button type="button" className="table-action" onClick={() => openDecision(report, 'suspend_user')}>Suspendre le compte</button>}
              </> : <span>Traité</span>}
              {report.community_id && <button type="button" className="table-action" onClick={() => onNavigate(`/admin/communities/${report.community_id}`)}>Voir communauté</button>}
            </div></td>
          </tr>)}
        </tbody></table></div>}
      {!loading && hasMore && <div className="table-footer"><span>Plus de signalements disponibles</span><button type="button" className="scrole-button scrole-button-secondary" onClick={() => setOffset(current => current + 50)}>Charger les suivants</button></div>}
    </Card>
    {selected && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="report-decision-title">
      <header className="modal-header"><h2 id="report-decision-title">{decision === 'dismiss' ? 'Rejeter le signalement' : decision === 'remove_content' ? 'Supprimer le contenu signalé' : 'Suspendre le compte signalé'}</h2><button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="Fermer">×</button></header>
      <div className="modal-body"><p><strong>{selected.reason?.nom ?? 'Signalement'}</strong> · {labelType(selected.target_type)}</p><p>Origine : {selected.community?.name ?? (selected.community_id ?? 'Plateforme')}{selected.escalated ? ' · remonté après 48 heures' : selected.source === 'external_profile' ? ' · signalement de profil externe' : ''}</p><label className="field">Note de modération<textarea value={note} onChange={e => setNote(e.target.value)} rows={4} maxLength={1000} placeholder="Motif de la décision (facultatif)" /></label></div>
      <footer className="modal-footer"><button type="button" className="scrole-button scrole-button-secondary" onClick={() => setSelected(null)}>Annuler</button><button type="button" className="scrole-button scrole-button-danger" disabled={busyId === selected.id} onClick={() => void submitDecision()}>{busyId === selected.id ? 'Enregistrement…' : 'Confirmer la décision'}</button></footer>
    </section></div>}
  </>
}

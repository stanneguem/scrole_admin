import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { supabase } from '../../lib/supabase'

type ModerationAction = { id: string; event_id: string; admin_id: string; action: string; reason: string | null; previous_status: string | null; new_status: string | null; previous_is_public: boolean | null; new_is_public: boolean | null; created_at: string };\ntype LinkedEvent = { link_id: string; event_id: string; price: number | null; added_by: string | null; linked_at: string; event: { id: string; name: string; status: string; starts_at: string | null; ends_at: string | null; creator_id: string } | null; moderation?: ModerationAction[] }
type Activity = { id: string; created_at: string; updated_at?: string; action: string; source: string; actor_id?: string | null; target_id?: string | null; target_type?: string | null; reason?: string | null; name?: string; status?: string; base_price?: number | null; currency_code?: string | null; added_count?: number; event_only?: boolean; description?: string | null; scheduled_deletion_at?: string | null; linked_events?: number; events?: LinkedEvent[]; details?: Record<string, unknown> }
export function ActivityLogPage({ detailMode = false }: { detailMode?: boolean }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    supabase.functions.invoke('admin-activity-directory', { body: detailMode ? { id, limit: 1000 } : { limit: 1000 } })
      .then(({ data, error: invokeError }) => {
        if (invokeError) throw invokeError
        if (!data?.success) throw new Error(data?.message || 'Chargement impossible')
        if (active) setActivities(data.activities || [])
      }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, detailMode])
  const filtered = useMemo(() => activities.filter(a => JSON.stringify(a).toLowerCase().includes(search.toLowerCase())), [activities, search])
  const selected = activities.find(a => a.id === id)
  const date = (v?: string | null) => v ? new Date(v).toLocaleString('fr-FR') : '—'
  const statusLabel = (s?: string) => s === 'active' ? 'Active' : s === 'deleted' ? 'Supprimée' : s || '—'
  return <>
    <header className="admin-page-header"><div>{detailMode && <button className="back-action" onClick={() => navigate('/admin/system/activity')}>← Retour</button>}<h1>{detailMode ? (selected?.name || 'Détail de l’activité') : 'Activités'}</h1><p>Activités enregistrées sur Scrole et événements auxquels elles sont associées.</p></div></header>
    {loading && <Card><p>Chargement des activités…</p></Card>}
    {error && <Card><p role="alert">{error}</p></Card>}
    {!loading && !error && detailMode && (!selected ? <Card><p>Activité introuvable.</p></Card> : <div className="detail-grid">
      <Card title="Informations de l’activité"><div className="detail-list"><div><span>Nom</span><strong>{selected.name || '—'}</strong></div><div><span>Statut</span><strong>{statusLabel(selected.status)}</strong></div><div><span>Créée le</span><strong>{date(selected.created_at)}</strong></div><div><span>Modifiée le</span><strong>{date(selected.updated_at)}</strong></div><div><span>Créateur (ID)</span><strong>{selected.actor_id || '—'}</strong></div><div><span>Prix de base</span><strong>{selected.base_price == null ? 'Gratuit / non défini' : `${selected.base_price} ${selected.currency_code || ''}`}</strong></div><div><span>Nombre ajouté</span><strong>{selected.added_count ?? 0}</strong></div><div><span>Réservée aux événements</span><strong>{selected.event_only ? 'Oui' : 'Non'}</strong></div><div><span>Suppression programmée</span><strong>{date(selected.scheduled_deletion_at)}</strong></div></div>{selected.description && <p>{selected.description}</p>}</Card>
      <Card title={`Événements liés (${selected.events?.length ?? 0})`}>{selected.events?.length ? <div className="detail-list">{selected.events.map(link => <div key={link.link_id}><strong>{link.event?.name || 'Événement introuvable'}</strong><span>Statut : {statusLabel(link.event?.status)} · Début : {date(link.event?.starts_at)}</span><span>Prix dans l’événement : {link.price == null ? '—' : `${link.price} ${selected.currency_code || ''}`}</span><span>Ajoutée le : {date(link.linked_at)}</span><small>ID événement : {link.event_id}</small><div className="detail-list"><strong>Historique de modération ({link.moderation?.length ?? 0})</strong>{link.moderation?.length ? link.moderation.map(m => <div key={m.id}><strong>{m.action}</strong><span>Le {date(m.created_at)} · Admin : {m.admin_id}</span><span>Motif : {m.reason || 'Aucun motif renseigné'}</span><span>Statut : {m.previous_status || '—'} → {m.new_status || '—'}</span><span>Visibilité publique : {m.previous_is_public == null ? '—' : m.previous_is_public ? 'Public' : 'Privé'} → {m.new_is_public == null ? '—' : m.new_is_public ? 'Public' : 'Privé'}</span></div>) : <span>Aucune action de modération enregistrée pour cet événement.</span>}</div></div>)}</div> : <p>Cette activité n’est liée à aucun événement dans la table event_activities.</p>}</Card>
      <Card title="Identifiants"><div className="detail-list"><div><span>ID activité</span><strong>{selected.id}</strong></div><div><span>Type</span><strong>{selected.event_only ? 'Activité uniquement événement' : 'Activité générale'}</strong></div></div></Card>
    </div>)}
    {!loading && !error && !detailMode && <Card className="resource-card"><div className="resource-toolbar"><label className="search-field"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une activité ou un événement…" aria-label="Rechercher une activité ou un événement" /></label><span className="result-count">{filtered.length} activité(s)</span></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>Activité</th><th>Statut</th><th>Créée le</th><th>Événements liés</th><th>Prix de base</th></tr></thead><tbody>{filtered.map(a => <tr key={a.id} onClick={() => navigate('/admin/system/activity/' + encodeURIComponent(a.id))} style={{ cursor: 'pointer' }}><td><strong>{a.name || 'Activité sans nom'}</strong><small>{a.id}</small></td><td>{statusLabel(a.status)}</td><td>{date(a.created_at)}</td><td>{a.linked_events ?? 0}{a.events?.length ? <small>{a.events.map(e => e.event?.name || e.event_id).join(', ')}</small> : null}</td><td>{a.base_price == null ? '—' : `${a.base_price} ${a.currency_code || ''}`}</td></tr>)}</tbody></table>{filtered.length === 0 && <div className="table-empty">Aucune activité trouvée.</div>}</div></Card>}
  </>
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { supabase } from '../../lib/supabase'

type Activity = { id: string; created_at: string; action: string; source: string; actor_id?: string | null; target_id?: string | null; target_type?: string | null; reason?: string | null; details?: Record<string, unknown> }
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
  const date = (v: string) => new Date(v).toLocaleString('fr-FR')
  return <>
    <header className="admin-page-header"><div>{detailMode && <button className="back-action" onClick={() => navigate('/admin/system/activity')}>← Retour</button>}<h1>{detailMode ? 'Détail de l’activité' : 'Journal d’activité'}</h1><p>Historique des actions disponibles dans Supabase.</p></div></header>
    {loading && <Card><p>Chargement…</p></Card>}
    {error && <Card><p role="alert">{error}</p></Card>}
    {!loading && !error && detailMode && (!selected ? <Card><p>Activité introuvable.</p></Card> : <div className="detail-grid">
      <Card title="Informations"><div className="detail-list"><div><span>Action</span><strong>{selected.action}</strong></div><div><span>Date</span><strong>{date(selected.created_at)}</strong></div><div><span>Identifiant</span><strong>{selected.id}</strong></div><div><span>Source</span><strong>{selected.source}</strong></div><div><span>Type de cible</span><strong>{selected.target_type || '—'}</strong></div><div><span>Identifiant de cible</span><strong>{selected.target_id || '—'}</strong></div></div></Card>
      <Card title="Contexte"><div className="detail-list"><div><span>Utilisateur / administrateur</span><strong>{selected.actor_id || '—'}</strong></div><div><span>Motif</span><strong>{selected.reason || '—'}</strong></div></div><pre>{JSON.stringify(selected.details || {}, null, 2)}</pre></Card>
    </div>)}
    {!loading && !error && !detailMode && <Card className="resource-card"><div className="resource-toolbar"><label className="search-field"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une activité…" aria-label="Rechercher une activité" /></label><span className="result-count">{filtered.length} résultat(s)</span></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>Date</th><th>Action</th><th>Source</th><th>Utilisateur / admin</th><th>Motif</th></tr></thead><tbody>{filtered.map(a => <tr key={a.source + a.id} onClick={() => navigate('/admin/system/activity/' + encodeURIComponent(a.id))} style={{ cursor: 'pointer' }}><td>{date(a.created_at)}<small>{a.id}</small></td><td>{a.action}</td><td>{a.source}</td><td>{a.actor_id || '—'}</td><td>{a.reason || '—'}</td></tr>)}</tbody></table>{filtered.length === 0 && <div className="table-empty">Aucune activité trouvée dans le journal disponible.</div>}</div></Card>}
  </>
}

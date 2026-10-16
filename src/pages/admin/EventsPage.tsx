import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { supabase } from '../../lib/supabase'

type EventRow = {
  id: string; name: string | null; slug: string | null; description: string | null
  starts_at: string | null; ends_at: string | null; status: string | null
  is_public: boolean | null; is_free: boolean | null; address: string | null
  city?: { nom?: string | null } | null; country?: { nom?: string | null } | null
  community?: { name?: string | null } | null
  creator?: { username?: string | null; first_name?: string | null; last_name?: string | null } | null
  participant_count?: number; checked_in_count?: number
}
type Payload = { events?: EventRow[]; data?: EventRow[]; error?: string }

const dateLabel = (value: string | null | undefined) => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date non précisée'
const statusTone = (value: string | null | undefined): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
  const status = (value ?? '').toLowerCase()
  if (['active', 'published', 'published', 'actif', 'approved'].includes(status)) return 'success'
  if (['cancelled', 'canceled', 'rejected', 'supprimé', 'deleted'].includes(status)) return 'danger'
  if (['pending', 'draft', 'en attente'].includes(status)) return 'warning'
  return 'info'
}
export function EventsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    supabase.functions.invoke('admin-events-directory', { body: {} })
      .then(({ data, error: invokeError }) => {
        if (!alive) return
        if (invokeError) throw invokeError
        const payload = data as Payload | EventRow[] | null
        const rows = Array.isArray(payload) ? payload : (payload?.events ?? payload?.data ?? [])
        if (!Array.isArray(rows)) throw new Error((payload as Payload | null)?.error || 'Réponse inattendue du serveur.')
        setEvents(rows)
      })
      .catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : 'Impossible de charger les événements.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reload])

  const filtered = useMemo(() => {
    const now = Date.now()
    return events.filter((event) => {
      const start = event.starts_at ? new Date(event.starts_at).getTime() : null
      const end = event.ends_at ? new Date(event.ends_at).getTime() : null
      const matchesFilter = filter === 'all' || (filter === 'upcoming' && start !== null && start > now) ||
        (filter === 'ongoing' && start !== null && start <= now && (end === null || end >= now)) ||
        (filter === 'past' && end !== null && end < now)
      const haystack = [event.name, event.slug, event.description, event.address, event.city?.nom, event.country?.nom, event.community?.name, event.creator?.username, event.creator?.first_name, event.creator?.last_name].filter(Boolean).join(' ').toLowerCase()
      return matchesFilter && haystack.includes(query.toLowerCase().trim())
    })
  }, [events, filter, query])

  const ongoingCount = events.filter((event) => {
    const start = event.starts_at ? new Date(event.starts_at).getTime() : null
    const end = event.ends_at ? new Date(event.ends_at).getTime() : null
    return start !== null && start <= Date.now() && (end === null || end >= Date.now())
  }).length

  return <>
    <header className="admin-page-header">
      <div><h1>Événements</h1><p>Consultez les événements réels de Scrole et suivez leur participation.</p></div>
      <div className="admin-page-actions"><button type="button" className="pagination-button" onClick={() => setReload((value) => value + 1)}>↻ Actualiser</button></div>
    </header>
    <div className="detail-grid">
      <Card><div className="detail-list"><div><span>Total chargés</span><strong>{events.length}</strong></div></div></Card>
      <Card><div className="detail-list"><div><span>En cours</span><strong>{ongoingCount}</strong></div></div></Card>
      <Card><div className="detail-list"><div><span>Résultats</span><strong>{filtered.length}</strong></div></div></Card>
    </div>
    <Card className="resource-card">
      <div className="resource-toolbar">
        <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un événement, lieu, organisateur…" aria-label="Rechercher un événement" /></label>
        <select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrer les événements">
          <option value="all">Toutes les dates</option><option value="ongoing">En cours</option><option value="upcoming">À venir</option><option value="past">Terminés</option>
        </select>
      </div>
      {error && <div className="table-empty" role="alert"><strong>Le chargement a échoué</strong><p>{error}</p><button type="button" className="table-action" onClick={() => setReload((value) => value + 1)}>Réessayer</button></div>}
      {loading && <div className="table-empty">Chargement des événements…</div>}
      {!loading && !error && <div className="table-scroll"><table className="admin-table"><thead><tr><th>Événement</th><th>Date et lieu</th><th>Organisateur</th><th>Participation</th><th>Statut</th><th>Visibilité</th></tr></thead><tbody>
        {filtered.map((event) => {
          const creatorName = [event.creator?.first_name, event.creator?.last_name].filter(Boolean).join(' ') || event.creator?.username || 'Organisateur inconnu'
          const place = [event.address, event.city?.nom, event.country?.nom].filter(Boolean).join(', ') || (event.is_virtual ? 'En ligne' : 'Lieu non précisé')
          return <tr key={event.id} onClick={() => onNavigate('/admin/events/' + event.id)} style={{ cursor: 'pointer' }}>
            <td><strong>{event.name || event.slug || 'Événement sans nom'}</strong><small>{event.id}{event.community?.name ? ' · ' + event.community.name : ''}</small></td>
            <td>{dateLabel(event.starts_at)}<small>{place}</small></td>
            <td>{creatorName}</td>
            <td><strong>{event.participant_count ?? 0}</strong><small>{event.checked_in_count ?? 0} présent(s)</small></td>
            <td><StatusBadge tone={statusTone(event.status)}>{event.status || 'Non défini'}</StatusBadge></td>
            <td><StatusBadge tone={event.is_public ? 'success' : 'neutral'}>{event.is_public ? 'Public' : 'Privé'}</StatusBadge></td>
          </tr>
        })}
      </tbody></table>{filtered.length === 0 && <div className="table-empty">Aucun événement ne correspond à cette recherche.</div>}</div>}
    </Card>
  </>
}

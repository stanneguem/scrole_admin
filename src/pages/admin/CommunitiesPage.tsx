import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ScroleButton } from '../../components/ui/ScroleButton'
import './CommunitiesPage.css'

type Community = {
  id: string
  name: string
  slug: string
  description: string
  photo_profile: string | null
  photo_cover: string | null
  visibility: 'public' | 'prive'
  status: 'active' | 'pending_deletion' | 'deleted'
  created_at: string
  scheduled_deletion_at: string | null
  members_count: number
  posts_count: number
  pending_posts_count: number
  creator: { username: string | null; first_name: string | null; last_name: string | null; photo_url: string | null } | null
}

const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value))
  : '—'

const statusLabel: Record<Community['status'], string> = {
  active: 'Active',
  pending_deletion: 'Suppression programmée',
  deleted: 'Supprimée',
}

const statusTone = (status: Community['status']) =>
  status === 'active' ? 'success' : status === 'pending_deletion' ? 'warning' : 'danger'

export function CommunitiesPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [communities, setCommunities] = useState<Community[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [uniqueCommunityMembers, setUniqueCommunityMembers] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      const { data, error: invokeError } = await supabase.functions.invoke('admin-community-directory', { body: {} })
      if (cancelled) return
      if (invokeError || !data?.success) {
        setError(data?.message ?? invokeError?.message ?? 'Impossible de charger les communautés.')
        setCommunities([])
        setUniqueCommunityMembers(0)
      } else {
        setCommunities((data.communities ?? []) as Community[])
        setUniqueCommunityMembers(Number(data.unique_community_members ?? 0))
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [refreshKey])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr')
    return communities.filter((community) => {
      const creator = community.creator
      const creatorName = [creator?.first_name, creator?.last_name].filter(Boolean).join(' ')
      const matchesQuery = !normalizedQuery || [
        community.name, community.slug, community.description, creatorName, creator?.username,
      ].some((value) => value?.toLocaleLowerCase('fr').includes(normalizedQuery))
      return matchesQuery && (status === 'all' || community.status === status)
    })
  }, [communities, query, status])

  const activeCount = communities.filter((community) => community.status === 'active').length
  const postCount = communities.reduce((total, community) => total + community.posts_count, 0)

  return <>
    <header className="admin-page-header">
      <div><h1>Communautés</h1><p>Consultez les communautés réelles de Scrole et leur activité.</p></div>
      <div className="admin-page-actions">
        <ScroleButton variant="secondary" onClick={() => setRefreshKey((value) => value + 1)}>Actualiser</ScroleButton>
        <ScroleButton onClick={() => onNavigate('/admin')}>Retour au dashboard</ScroleButton>
      </div>
    </header>

    <section className="communities-summary" aria-label="Résumé des communautés">
      <Card><span className="communities-summary-label">Communautés enregistrées</span><strong>{communities.length}</strong><small>Données Supabase</small></Card>
      <Card><span className="communities-summary-label">Communautés actives</span><strong>{activeCount}</strong><small>Statut actif en base</small></Card>
      <Card><span className="communities-summary-label">Membres des communautés</span><strong>{uniqueCommunityMembers.toLocaleString('fr-FR')}</strong><small>Utilisateurs distincts membres d’au moins une communauté</small></Card>
      <Card><span className="communities-summary-label">Publications dans les communautés</span><strong>{postCount.toLocaleString('fr-FR')}</strong><small>Exclut les publications hors communautés</small></Card>
    </section>

    <Card className="resource-card communities-card">
      <div className="resource-toolbar">
        <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une communauté ou son créateur" aria-label="Rechercher une communauté" /></label>
        <select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrer les communautés">
          <option value="all">Tous les statuts</option>
          <option value="active">Active</option>
          <option value="pending_deletion">Suppression programmée</option>
          <option value="deleted">Supprimée</option>
        </select>
        <span className="result-count">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {loading ? <div className="table-empty">Chargement des communautés depuis Supabase…</div>
        : error ? <div className="table-empty communities-error"><strong>Impossible de charger les communautés</strong><p>{error}</p><ScroleButton onClick={() => setRefreshKey((value) => value + 1)}>Réessayer</ScroleButton></div>
        : <div className="table-scroll"><table className="admin-table communities-table">
          <thead><tr><th>Communauté</th><th>Créateur</th><th>Statut</th><th>Membres</th><th>Publications</th><th>Visibilité</th><th>Créée le</th></tr></thead>
          <tbody>{filtered.map((community) => {
            const creatorName = [community.creator?.first_name, community.creator?.last_name].filter(Boolean).join(' ') || (community.creator?.username ? `@${community.creator.username}` : 'Créateur indisponible')
            return <tr key={community.id}>
              <td><button type="button" className="community-identity community-open-button" onClick={() => onNavigate("/admin/communities/" + community.id)} aria-label={"Ouvrir la communauté " + community.name}>
                {community.photo_profile ? <img src={community.photo_profile} alt="" className="community-avatar" /> : <span className="community-avatar community-avatar-fallback">{community.name.slice(0, 1).toUpperCase() || 'C'}</span>}
                <span><strong>{community.name}</strong><small>{community.slug}</small><small>{community.description || 'Aucune description'}</small></span>
              </button></td>
              <td>{creatorName}</td>
              <td><StatusBadge tone={statusTone(community.status)}>{statusLabel[community.status] ?? community.status}</StatusBadge>{community.pending_posts_count > 0 && <small className="community-pending-count">{community.pending_posts_count} publication(s) en attente</small>}</td>
              <td>{community.members_count.toLocaleString('fr-FR')}</td>
              <td>{community.posts_count.toLocaleString('fr-FR')}</td>
              <td>{community.visibility === 'prive' ? 'Privée' : 'Publique'}</td>
              <td>{formatDate(community.created_at)}</td>
            </tr>
          })}</tbody>
        </table>{filtered.length === 0 && <div className="table-empty">Aucune communauté ne correspond à ces filtres.</div>}</div>}
      <footer className="table-footer"><span>{loading ? 'Chargement…' : `${filtered.length} communauté(s) affichée(s)`}</span><span className="communities-source-note">Source : base de données Scrole</span></footer>
    </Card>
  </>
}

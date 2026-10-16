import { useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { AdminRecord, ResourceKey } from '../../types/admin'
import { updateResourceStatus, useMockStore } from '../../services/mockStore'

type ResourceConfig = { title: string; description: string; action?: string; columns: string[] }
const configs: Record<ResourceKey, ResourceConfig> = {
  reports: { title: 'Signalements', description: 'Examinez et traitez les signalements remontés par la communauté.', action: 'Assigner un signalement', columns: ['Signalement', 'Motif', 'Cible', 'Statut', 'Date'] },
  users: { title: 'Utilisateurs', description: 'Consultez les comptes et intervenez sur leur statut.', action: 'Exporter', columns: ['Utilisateur', 'Statut', 'Activité', 'Inscription', 'Actions'] },
  communities: { title: 'Communautés', description: 'Surveillez les communautés et leur activité.', action: 'Exporter', columns: ['Communauté', 'Statut', 'Membres', 'Description', 'Actions'] },
  posts: { title: 'Publications', description: 'Modérez les contenus publiés sur Scrole.', action: 'Exporter', columns: ['Publication', 'Auteur', 'Statut', 'Communauté', 'Actions'] },
  events: { title: 'Événements', description: 'Gérez les événements créés par la communauté.', action: 'Exporter', columns: ['Événement', 'Date / lieu', 'Statut', 'Participants', 'Actions'] },
  administrators: { title: 'Administrateurs', description: 'Gérez les accès des administrateurs Scrole.', action: 'Ajouter un administrateur', columns: ['Administrateur', 'Rôle', 'Statut', 'Dernière activité', 'Actions'] },
  roles: { title: 'Rôles', description: 'Préparez et consultez la matrice des rôles.', columns: ['Rôle', 'Description', 'Statut', 'Administrateurs', 'Actions'] },
  permissions: { title: 'Permissions', description: 'Référence des permissions disponibles pour le futur RBAC.', columns: ['Permission', 'Description', 'Statut', 'Rôles', 'Actions'] },
  activity: { title: 'Activité système', description: 'Suivez les actions importantes réalisées dans l’administration.', columns: ['Action', 'Utilisateur', 'Type', 'Statut', 'Date'] },
  'moderation-actions': { title: 'Historique de modération', description: 'Une traçabilité claire des actions réalisées par l’équipe.', columns: ['Action', 'Modérateur', 'Cible', 'Statut', 'Date'] },
  'hidden-content': { title: 'Contenu masqué', description: 'Retrouvez les contenus masqués et décidez de leur suite.', columns: ['Contenu', 'Auteur', 'Statut', 'Motif', 'Actions'] },
}

export function ResourcePage({ resource, onNavigate }: { resource: ResourceKey; onNavigate: (path: string) => void }) {
  const store = useMockStore()
  const config = configs[resource]
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Tous les statuts')
  const [page, setPage] = useState(1)
  const sharedRecords = store.resources[resource]
  const [selected, setSelected] = useState<AdminRecord | null>(null)
  const filtered = useMemo(() => sharedRecords.filter((record) => `${record.title} ${record.subtitle} ${record.id}`.toLowerCase().includes(query.toLowerCase()) && (status === 'Tous les statuts' || record.status === status)), [sharedRecords, query, status])
  const visible = filtered.slice((page - 1) * 4, page * 4)
  const updateStatus = (record: AdminRecord) => { const nextStatus = record.status === 'Suspendu' ? 'Actif' : 'Suspendu'; updateResourceStatus(resource, record.id, nextStatus); setSelected(null) }

  return <>
    <header className="admin-page-header"><div><h1>{config.title}</h1><p>{config.description}</p></div><div className="admin-page-actions">{config.action && <ScroleButton variant="secondary">{config.action}</ScroleButton>}<ScroleButton onClick={() => onNavigate('/admin')}>Retour au dashboard</ScroleButton></div></header>
    <Card className="resource-card"><div className="resource-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={`Rechercher dans ${config.title.toLowerCase()}`} aria-label={`Rechercher dans ${config.title}`} /></label><select className="filter-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Filtrer par statut"><option>Tous les statuts</option><option>Actif</option><option>Ouvert</option><option>En attente</option><option>Résolu</option><option>Suspendu</option><option>Masqué</option></select><span className="result-count">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span></div>
      <div className="table-scroll"><table className="admin-table"><thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{visible.map((record) => <tr key={record.id} onClick={() => onNavigate(`${resource === 'reports' ? '/admin/reports' : `/admin/${resource}`}/${record.id}`)}><td><strong>{record.title}</strong><small>{record.id} · {record.subtitle}</small></td><td>{record.meta}</td><td><StatusBadge tone={record.status === 'Actif' || record.status === 'Résolu' ? 'success' : record.status === 'Suspendu' || record.status === 'Masqué' ? 'danger' : 'warning'}>{record.status}</StatusBadge></td><td>{record.detail}</td><td><button type="button" className="table-action" onClick={(event) => { event.stopPropagation(); setSelected(record) }}>Gérer</button></td></tr>)}</tbody></table>{visible.length === 0 && <div className="table-empty">Aucun résultat trouvé.</div>}</div>
      <footer className="table-footer"><span>Page {page} sur {Math.max(1, Math.ceil(filtered.length / 4))}</span><div><button type="button" className="pagination-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>←</button><button type="button" className="pagination-button" disabled={page >= Math.ceil(filtered.length / 4)} onClick={() => setPage((current) => current + 1)}>→</button></div></footer>
    </Card>
    {selected && <Modal title={`Gérer ${selected.title}`} onClose={() => setSelected(null)} confirmLabel={selected.status === 'Suspendu' ? 'Réactiver' : 'Suspendre'} danger={selected.status !== 'Suspendu'} onConfirm={() => updateStatus(selected)}><p>{selected.detail}.</p><p>Cette action est simulée localement et sera reliée au service de modération ultérieurement.</p></Modal>}
  </>
}
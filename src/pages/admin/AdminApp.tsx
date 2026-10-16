import { useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '../../layouts/AdminLayout'
import { resourceData } from '../../mocks/adminData'
import type { AdminRecord, ResourceKey } from '../../types/admin'
import type { Permission } from '../../types/auth'
import { DashboardPage } from './DashboardPage'
import { ResourcePage } from './ResourcePage'
import { SettingsPage } from './SettingsPage'
import { AdministratorsPage } from './AdministratorsPage'
import { UsersPage } from './UsersPage'
import { CommunitiesPage } from './CommunitiesPage'
import { CommunityDetailPage } from './CommunityDetailPage'
import { PermissionsPage } from './PermissionsPage'
import { RolesPage } from './RolesPage'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { UserInspectorPage } from './UserInspectorPage'
import { ContextInspectorPage } from './ContextInspectorPage'
import { CertificationPricingPage } from './CertificationPricingPage'
import { ActivityValidationPage } from './ActivityValidationPage'
import { EventsPage } from './EventsPage'
import { EventDetailPage } from './EventDetailPage'
import { useAuth } from '../../hooks/useAuth'

const resourcePaths: Record<string, ResourceKey> = { reports: 'reports', communities: 'communities', posts: 'posts', events: 'events', administrators: 'administrators', 'system/activity': 'activity', 'moderation/actions': 'moderation-actions', 'moderation/hidden': 'hidden-content' }
const routePermissions: Record<string, Permission> = { reports: 'reports.view', communities: 'communities.view', posts: 'posts.view', events: 'events.view', administrators: 'administrators.view', roles: 'administrators.manage_roles', 'system/activity': 'system.view', 'moderation/actions': 'reports.view', 'moderation/hidden': 'posts.hide', 'certification-pricing': 'settings.edit', settings: 'settings.edit' }

function PermissionGate({ permission, children }: { permission: Permission; children: ReactNode }) { const { hasPermission } = useAuth(); return hasPermission(permission) ? <>{children}</> : <Navigate to="/access-denied" replace /> }
function AdminPage() { const location = useLocation(); const navigate = useNavigate(); return <AdminLayout pathname={location.pathname}><Routes>
  <Route index element={<DashboardPage />} />
  <Route path="activities/validation" element={<PermissionGate permission="activity.view"><ActivityValidationPage /></PermissionGate>} />
  <Route path="settings" element={<PermissionGate permission="settings.edit"><SettingsPage /></PermissionGate>} />
  <Route path="certification-pricing" element={<PermissionGate permission="settings.edit"><CertificationPricingPage /></PermissionGate>} />
  <Route path="permissions" element={<PermissionGate permission="administrators.manage_roles"><PermissionsPage /></PermissionGate>} />
  <Route path="roles" element={<PermissionGate permission="administrators.manage_roles"><RolesPage /></PermissionGate>} />
  <Route path="administrators" element={<PermissionGate permission="administrators.view"><AdministratorsPage /></PermissionGate>} />
  <Route path="users" element={<PermissionGate permission="users.view"><UsersPage onNavigate={navigate} /></PermissionGate>} />
  <Route path="communities" element={<PermissionGate permission="communities.view"><CommunitiesPage onNavigate={navigate} /></PermissionGate>} />
  <Route path="events" element={<PermissionGate permission="events.view"><EventsPage onNavigate={navigate} /></PermissionGate>} />
  {Object.entries(resourcePaths).filter(([path]) => path !== "communities" && path !== "events").map(([path, resource]) => <Route key={path} path={path} element={<PermissionGate permission={routePermissions[path]}><ResourcePage resource={resource} onNavigate={navigate} /></PermissionGate>} />)}
  <Route path="users/:id" element={<PermissionGate permission="users.view"><UserInspectorRoute /></PermissionGate>} />
  <Route path="communities/:id" element={<PermissionGate permission="communities.view"><CommunityDetailPage onNavigate={navigate} /></PermissionGate>} />
  <Route path="posts/:id" element={<PermissionGate permission="posts.view"><ContextInspectorRoute resource="posts" /></PermissionGate>} />
  <Route path="events/:id" element={<PermissionGate permission="events.view"><EventDetailRoute /></PermissionGate>} />
  <Route path="reports/:id" element={<PermissionGate permission="reports.view"><ContextInspectorRoute resource="reports" /></PermissionGate>} />
  <Route path="reports/:id/detail" element={<PermissionGate permission="reports.view"><RecordDetailRoute resource="reports" /></PermissionGate>} />
  <Route path="users/:id/detail" element={<PermissionGate permission="users.view"><RecordDetailRoute resource="users" /></PermissionGate>} />
  <Route path="communities/:id/detail" element={<PermissionGate permission="communities.view"><RecordDetailRoute resource="communities" /></PermissionGate>} />
  <Route path="posts/:id/detail" element={<PermissionGate permission="posts.view"><RecordDetailRoute resource="posts" /></PermissionGate>} />
  <Route path="events/:id/detail" element={<PermissionGate permission="events.view"><RecordDetailRoute resource="events" /></PermissionGate>} />
  <Route path="*" element={<Navigate to="/admin" replace />} />
</Routes></AdminLayout> }
function UserInspectorRoute() { const { id = '' } = useParams(); const navigate = useNavigate(); return <UserInspectorPage userId={id} onNavigate={navigate} /> }
function EventDetailRoute() { const { id = '' } = useParams(); const navigate = useNavigate(); return <EventDetailPage eventId={id} onNavigate={navigate} /> }
function ContextInspectorRoute({ resource }: { resource: 'communities' | 'posts' | 'events' | 'reports' }) { const { id = '' } = useParams(); const navigate = useNavigate(); return <ContextInspectorPage resource={resource} id={id} onNavigate={navigate} /> }
function RecordDetailRoute({ resource }: { resource: ResourceKey }) { const { id = '' } = useParams(); const navigate = useNavigate(); return <RecordDetailPage record={resourceData[resource].find((item) => item.id === id) ?? null} onNavigate={navigate} /> }
function RecordDetailPage({ record, onNavigate }: { record: AdminRecord | null; onNavigate: (path: string) => void }) { const [modal, setModal] = useState(false); const [message, setMessage] = useState(''); if (!record) return <Card><div className="table-empty"><strong>Élément introuvable</strong><p>Cette ressource n’existe pas dans les données mockées.</p><ScroleButton onClick={() => onNavigate('/admin')}>Retour au dashboard</ScroleButton></div></Card>; return <><header className="admin-page-header"><div><button type="button" className="back-action" onClick={() => onNavigate('/admin')}>← Retour</button><h1>{record.title}</h1><p>{record.id} · {record.category}</p></div><div className="admin-page-actions"><ScroleButton variant="secondary">Assigner</ScroleButton><ScroleButton variant="danger" onClick={() => setModal(true)}>Action de modération</ScroleButton></div></header>{message && <div className="toast-message" role="status">{message}</div>}<div className="detail-grid"><Card title="Informations générales"><div className="detail-list"><div><span>Statut</span><StatusBadge tone={record.status === 'Actif' || record.status === 'Résolu' ? 'success' : 'warning'}>{record.status}</StatusBadge></div><div><span>Type</span><strong>{record.category}</strong></div><div><span>Date</span><strong>{record.date}</strong></div><div><span>Résumé</span><strong>{record.subtitle}</strong></div></div></Card><Card title="Contexte"><div className="detail-context"><div className="content-placeholder">{record.detail}</div><p>Cette vue détail est alimentée par le repository mocké.</p></div></Card><Card title="Historique"><div className="timeline"><div><span className="timeline-dot" /><p><strong>Élément créé</strong><small>{record.date}</small></p></div></div></Card></div>{modal && <Modal title="Confirmer l’action de modération" onClose={() => setModal(false)} confirmLabel="Confirmer" danger onConfirm={() => { setModal(false); setMessage('Action enregistrée dans le journal.'); window.setTimeout(() => setMessage(''), 2600) }}><p>Vous êtes sur le point d’agir sur <strong>{record.title}</strong>.</p></Modal>}</> }
export { AdminPage as AdminApp }

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { AdminNavItem } from '../types/admin'
import { ScroleLogo } from '../components/brand/ScroleLogo'
import { useAuth } from '../hooks/useAuth'
import { resourceData } from '../mocks/adminData'
import '../theme/admin.css'
import '../pages/admin/AdminPolish.css'

const navGroups: { label: string; items: AdminNavItem[] }[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', path: '/admin', icon: '⌂' }] },
  { label: 'Modération', items: [
    { label: 'Signalements', path: '/admin/reports', icon: '!', requiredPermission: 'reports.view' },
    { label: 'Publications', path: '/admin/posts', icon: '□', requiredPermission: 'posts.view' },
    { label: 'Utilisateurs', path: '/admin/users', icon: '◉', requiredPermission: 'users.view' },
    { label: 'Communautés', path: '/admin/communities', icon: '◎', requiredPermission: 'communities.view' },
    { label: 'Événements', path: '/admin/events', icon: '◇', requiredPermission: 'events.view' }, { label: 'Activités à valider', path: '/admin/activities/validation', icon: '✓', requiredPermission: 'activity.view' },
    { label: 'Contenu masqué', path: '/admin/moderation/hidden', icon: '⊘', requiredPermission: 'posts.hide' },
    { label: 'Historique', path: '/admin/moderation/actions', icon: '≡', requiredPermission: 'reports.view' },
  ] },
  { label: 'Administration', items: [
    { label: 'Administrateurs', path: '/admin/administrators', icon: '◌', requiredPermission: 'administrators.view' },
    { label: 'Rôles', path: '/admin/roles', icon: '◆', requiredPermission: 'administrators.manage_roles' },
    { label: 'Permissions', path: '/admin/permissions', icon: '⊞', requiredPermission: 'administrators.manage_roles' },
    { label: 'Tarifs certifications', path: '/admin/certification-pricing', icon: '₣', requiredPermission: 'settings.edit' },
    { label: 'Tarifs événements et communautés', path: '/admin/entity-certification-prices', icon: '€', requiredPermission: 'settings.edit' },
    { label: 'Quotas Scrole', path: '/admin/quotas', icon: '↔', requiredPermission: 'certifications.manage' },
    { label: 'Réputation Scrole', path: '/admin/reputation', icon: '★', requiredPermission: 'reputation.manage' },
  ] },
  { label: 'Système', items: [
    { label: 'Activité', path: '/admin/system/activity', icon: '⌁', requiredPermission: 'system.view' },
    { label: 'Paramètres', path: '/admin/settings', icon: '⚙', requiredPermission: 'settings.edit' },
  ] },
]

export function AdminLayout({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { user, logout, hasPermission } = useAuth()
  const [dark, setDark] = useState(() => window.localStorage.getItem('scrole-admin-theme') === 'dark')
  const [search, setSearch] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  const toggleTheme = () => { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? 'dark' : 'light'; window.localStorage.setItem('scrole-admin-theme', next ? 'dark' : 'light') }
  const searchResults = search.trim() ? Object.entries(resourceData).flatMap(([resource, records]) => records.filter((record) => `${record.title} ${record.subtitle} ${record.id}`.toLowerCase().includes(search.toLowerCase())).slice(0, 2).map((record) => ({ ...record, resource }))).slice(0, 6) : []
  const navigateToResult = (resourceKey: string, id: string) => { const targetPath = resourceKey === 'reports' ? '/admin/reports' : resourceKey === 'hidden-content' ? '/admin/moderation/hidden' : resourceKey === 'moderation-actions' ? '/admin/moderation/actions' : `/admin/${resourceKey}`; window.history.pushState({}, '', `${targetPath}/${id}`); window.dispatchEvent(new PopStateEvent('popstate')) }
  const handleLogout = async () => { if (loggingOut) return; setLoggingOut(true); try { await logout(); window.history.replaceState({}, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate')) } finally { setLoggingOut(false) } }
  if (!user) return null
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/admin" aria-label="Scrole Admin, tableau de bord"><ScroleLogo /></a>
      <nav className="admin-nav" aria-label="Navigation principale">{navGroups.map((group) => { const visible = group.items.filter((item) => !item.requiredPermission || hasPermission(item.requiredPermission)); if (!visible.length) return null; return <div className="admin-nav-group" key={group.label}><span className="admin-nav-label">{group.label}</span>{visible.map((item) => <a className={`admin-nav-item ${pathname === item.path || (item.path !== '/admin' && pathname.startsWith(`${item.path}/`)) ? 'admin-nav-item-active' : ''}`} href={item.path} key={item.path}><span className="admin-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></a>)}</div> })}</nav>
      <div className="admin-sidebar-footer">Scrole Admin · v0.1</div>
    </aside>
    <div className="admin-main">
      <header className="admin-header"><span className="admin-header-context">Espace d’administration / <strong>{navGroups.flatMap((group) => group.items).find((item) => pathname === item.path)?.label ?? 'Détail'}</strong></span><div className="admin-header-actions"><div className="global-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher dans Scrole Admin..." aria-label="Rechercher dans Scrole Admin" />{searchResults.length > 0 && <div className="global-search-results">{searchResults.map((result) => <button type="button" key={`${result.resource}-${result.id}`} onClick={() => navigateToResult(result.resource, result.id)}><strong>{result.title}</strong><small>{result.category} · {result.id}</small></button>)}</div>}</div><button type="button" className="icon-button notification-button" aria-label="Notifications" title="Notifications"><span aria-hidden="true">♧</span><i>3</i></button><button type="button" className="icon-button" onClick={toggleTheme} aria-label={dark ? 'Activer le thème clair' : 'Activer le thème sombre'}>{dark ? '☼' : '◐'}</button><div className="admin-user"><span className="admin-avatar">{user.name.split(' ').map((part) => part[0]).join('')}</span><span className="admin-user-name">{user.name}<small className="admin-user-role">{user.role}</small></span><button type="button" className="logout-button" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? 'Déconnexion…' : 'Déconnexion'}</button></div></div></header>
      <main className="admin-content">{children}</main>
    </div>
  </div>
}

import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { CertificationCodeBadge } from '../../components/ui/CertificationCodeBadge'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import './UserAdminPolish.css'

type CertificationFilter = 'all' | 'certified' | 'basique' | 'pro' | 'premium' | 'none'
type DirectoryUser = {
  user_id: string
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  photo_url?: string | null
  account_status?: string | null
  is_verified?: boolean | null
  certification_code?: string | null
  created_at?: string | null
  email?: string | null
  last_sign_in_at?: string | null
}
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const initials = (first?: string | null, last?: string | null, username?: string | null) => [first, last].filter(Boolean).map(v => v![0]).join('').slice(0, 2).toUpperCase() || username?.slice(0, 2).toUpperCase() || 'SC'
const normalizeCode = (value?: string | null) => value?.trim().toLowerCase() ?? ''
const certificationLabel = (user: DirectoryUser) => {
  const code = normalizeCode(user.certification_code)
  if (code === 'premium') return 'Premium'
  if (code === 'pro') return 'Pro'
  if (code === 'basique' || code === 'basic') return 'Basique'
  return user.is_verified ? 'Vérifié · niveau à préciser' : 'Non certifié'
}
const hasCertification = (user: DirectoryUser) => Boolean(normalizeCode(user.certification_code) || user.is_verified)

export function UsersPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { hasPermission } = useAuth()
  const canViewUsers = hasPermission('users.view')
  const canEditUsers = hasPermission('users.edit')
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [query, setQuery] = useState('')
  const [certificationFilter, setCertificationFilter] = useState<CertificationFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!canViewUsers) { setUsers([]); setLoading(false); return }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      const { data, error: invokeError } = await supabase.functions.invoke('admin-user-directory', { body: { action: 'search', query } })
      if (cancelled) return
      if (invokeError || !data?.success) {
        setError(invokeError?.message ?? data?.message ?? 'Impossible de récupérer les utilisateurs.')
      } else {
        setUsers((data.users ?? []) as DirectoryUser[])
      }
      setLoading(false)
    }
    const timer = window.setTimeout(() => void load(), 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, canViewUsers, reloadKey])

  const filteredUsers = useMemo(() => users.filter(user => {
    const code = normalizeCode(user.certification_code)
    switch (certificationFilter) {
      case 'certified': return hasCertification(user)
      case 'none': return !hasCertification(user)
      case 'basique': return code === 'basique' || code === 'basic'
      case 'pro': return code === 'pro'
      case 'premium': return code === 'premium'
      default: return true
    }
  }), [users, certificationFilter])

  const certificationCounts = useMemo(() => ({
    certified: users.filter(hasCertification).length,
    basique: users.filter(user => ['basique', 'basic'].includes(normalizeCode(user.certification_code))).length,
    pro: users.filter(user => normalizeCode(user.certification_code) === 'pro').length,
    premium: users.filter(user => normalizeCode(user.certification_code) === 'premium').length,
    none: users.filter(user => !hasCertification(user)).length,
  }), [users])

  if (!canViewUsers) return <Card><div className="table-empty users-empty"><strong>Accès non autorisé</strong><p>La permission « Voir les utilisateurs » est désactivée pour votre rôle.</p></div></Card>

  return <>
    <header className="admin-page-header">
      <div><h1>Utilisateurs</h1><p>Identifiez rapidement les membres certifiés, leur niveau et leur statut de compte.</p></div>
      <div className="admin-page-actions">
        <ScroleButton variant="secondary" onClick={() => onNavigate('/admin')}>Retour au dashboard</ScroleButton>
        <ScroleButton variant="secondary" onClick={() => setReloadKey(value => value + 1)} disabled={loading}>Actualiser</ScroleButton>
      </div>
    </header>
    <div className="user-certification-summary" aria-label="Résumé des certifications">
      <div><span>Certifiés / vérifiés</span><strong>{certificationCounts.certified}</strong></div>
      <div><span>Basique</span><strong>{certificationCounts.basique}</strong></div>
      <div><span>Pro</span><strong>{certificationCounts.pro}</strong></div>
      <div><span>Premium</span><strong>{certificationCounts.premium}</strong></div>
      <div><span>Sans certification</span><strong>{certificationCounts.none}</strong></div>
    </div>
    <Card className="resource-card users-page-card">
      <div className="users-page-toolbar">
        <label className="search-field users-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher par nom, pseudo ou email" aria-label="Rechercher un utilisateur" /></label>
        <label className="users-certification-filter"><span>Certification</span><select value={certificationFilter} onChange={event => setCertificationFilter(event.target.value as CertificationFilter)} aria-label="Filtrer par certification">
          <option value="all">Tous les utilisateurs</option><option value="certified">Tous les certifiés / vérifiés</option><option value="basique">Basique</option><option value="pro">Pro</option><option value="premium">Premium</option><option value="none">Non certifiés</option>
        </select></label>
        <span className="result-count users-result-count">{filteredUsers.length} résultat{filteredUsers.length > 1 ? 's' : ''}</span>
      </div>
      {loading ? <div className="table-empty users-empty">Récupération des utilisateurs…</div> : error ? <div className="table-empty users-empty"><strong>Échec de récupération</strong><p>{error}</p><ScroleButton variant="secondary" onClick={() => setReloadKey(value => value + 1)}>Réessayer</ScroleButton></div> : <div className="table-scroll">
        <table className="admin-table users-table"><thead><tr><th>Utilisateur</th><th>Statut du compte</th><th>Type de certification</th><th>Inscription</th><th>Dernière connexion</th>{canEditUsers && <th>Action</th>}</tr></thead>
          <tbody>{filteredUsers.map(user => {
            const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.user_id
            const code = normalizeCode(user.certification_code)
            return <tr key={user.user_id} onClick={() => onNavigate(`/admin/users/${user.user_id}`)}>
              <td><div className="user-table-identity">{user.photo_url ? <img className="user-table-avatar-image" src={user.photo_url} alt="" /> : <span className="user-table-avatar" aria-hidden="true">{initials(user.first_name, user.last_name, user.username)}</span>}<div><strong>{name}</strong><small>@{user.username || '—'} · {user.email || 'email non renseigné'}</small></div></div></td>
              <td><StatusBadge tone={user.account_status === 'active' ? 'success' : 'danger'}>{user.account_status || 'Inconnu'}</StatusBadge></td>
              <td>{['basique', 'basic', 'pro', 'premium'].includes(code) ? <CertificationCodeBadge code={code === 'basic' ? 'basique' : code} compact /> : <span>{certificationLabel(user)}</span>}</td>
              <td>{formatDate(user.created_at)}</td><td>{formatDate(user.last_sign_in_at)}</td>
              {canEditUsers && <td><button type="button" className="table-action" onClick={event => { event.stopPropagation(); onNavigate(`/admin/users/${user.user_id}`) }}>Voir le profil</button></td>}
            </tr>
          })}</tbody>
        </table>
        {filteredUsers.length === 0 && <div className="table-empty users-empty">Aucun utilisateur ne correspond à ces critères.</div>}
      </div>}
      <p className="users-certification-note">Le niveau affiché dépend des données renvoyées par le service de gestion des utilisateurs. « Vérifié · niveau à préciser » indique que le compte est marqué vérifié mais que le niveau Basique/Pro/Premium n’est pas fourni par la récupération actuelle.</p>
    </Card>
  </>
}

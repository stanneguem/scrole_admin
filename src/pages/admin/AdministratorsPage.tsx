import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

type InviteRole = 'admin' | 'moderateur' | 'super_admin'
type ScroleUser = { user_id: string; username: string; first_name: string | null; last_name: string | null; email: string; photo_url: string | null; adminRole: InviteRole | null; adminActive: boolean }
const roleLabels: Record<InviteRole, string> = { admin: 'Admin', moderateur: 'Modérateur', super_admin: 'Super Admin' }

export function AdministratorsPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'Super Admin'
  const isAdmin = user?.role === 'Admin'
  const canManage = isSuperAdmin || isAdmin
  const [users, setUsers] = useState<ScroleUser[]>([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ScroleUser | null>(null)
  const [role, setRole] = useState<InviteRole>('moderateur')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = async () => {
    if (!canManage) return
    const { data, error: fnError } = await supabase.functions.invoke('admin-user-directory', { body: { action: 'search', query } })
    if (fnError) throw fnError
    if (!data?.success) throw new Error(data?.message || 'Impossible de charger les administrateurs.')
    setUsers(data.users ?? [])
  }

  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : 'Erreur.')) }, [user?.role])
  useEffect(() => { const timer = window.setTimeout(() => { if (open) void load().catch(e => setError(e instanceof Error ? e.message : 'Erreur.')) }, 300); return () => window.clearTimeout(timer) }, [query, open])

  const close = () => { if (!saving) { setOpen(false); setError(''); setQuery(''); setSelected(null); setRole('moderateur') } }

  const sendInvitation = async (target: ScroleUser, targetRole: InviteRole, resend = false) => {
    const { data, error: fnError } = await supabase.functions.invoke('invite-administrator', { body: { authId: target.user_id, role: targetRole, resend, redirectTo: `${window.location.origin}/admin/invitation` } })
    if (fnError) throw fnError
    if (!data?.success) throw new Error(data?.message || 'Impossible d’envoyer l’invitation.')
    return data
  }

  const invite = async () => {
    if (!canManage) return setError('Vous n’avez pas les droits nécessaires.')
    if (isAdmin && role !== 'moderateur') return setError('Un administrateur peut uniquement inviter un modérateur.')
    if (!selected) return setError('Sélectionnez un utilisateur Scrole.')
    setSaving(true); setError('')
    try { const data = await sendInvitation(selected, role); close(); setMessage(`Invitation envoyée à ${data.email}.`); await load(); window.setTimeout(() => setMessage(''), 3500) }
    catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’envoyer l’invitation.') }
    finally { setSaving(false) }
  }

  const toggleModerator = async (target: ScroleUser) => {
    if (!canManage || !target.adminRole) return
    if (isAdmin && target.adminRole !== 'moderateur') return setError('Un administrateur peut uniquement gérer les modérateurs.')
    const action = target.adminActive ? 'disable' : 'reactivate'
    if (!window.confirm(`${action === 'disable' ? 'Désactiver' : 'Réactiver'} ${[target.first_name, target.last_name].filter(Boolean).join(' ') || target.username} ?`)) return
    setBusyId(target.user_id); setError('')
    try { const { data, error: fnError } = await supabase.functions.invoke('admin-manage-administrator', { body: { authId: target.user_id, action } }); if (fnError) throw fnError; if (!data?.success) throw new Error(data?.message || 'Action impossible.'); await load(); setMessage(action === 'disable' ? 'Modérateur désactivé.' : 'Modérateur réactivé.'); window.setTimeout(() => setMessage(''), 3000) }
    catch (e) { setError(e instanceof Error ? e.message : 'Action impossible.') }
    finally { setBusyId(null) }
  }

  const adminUsers = users.filter(u => u.adminRole && (isSuperAdmin || u.adminRole === 'moderateur'))
  const inviteCandidates = users.filter(u => !u.adminRole).slice(0, 8)

  return <>
    <header className="admin-page-header"><div><h1>Administrateurs</h1><p>{isAdmin ? 'Gérez les modérateurs de Scrole.' : 'Gérez les accès de toute l’équipe d’administration.'}</p></div>{canManage && <ScroleButton onClick={() => setOpen(true)}>+ Inviter {isAdmin ? 'un modérateur' : 'un administrateur'}</ScroleButton>}</header>
    {message && <div className="toast-message" role="status">{message}</div>}
    {error && !open && <div className="field-error" role="alert">{error}</div>}
    <Card className="resource-card"><div className="table-scroll"><table className="admin-table"><thead><tr><th>Utilisateur</th><th>E-mail</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{adminUsers.map(u => <tr key={u.user_id}><td><strong>{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}</strong><small>@{u.username}</small></td><td>{u.email || '—'}</td><td>{u.adminRole ? roleLabels[u.adminRole] : '—'}</td><td><StatusBadge tone={u.adminActive ? 'success' : 'warning'}>{u.adminActive ? 'Actif' : 'Désactivé / invitation'}</StatusBadge></td><td><button type="button" className="table-action" disabled={busyId === u.user_id} onClick={() => void toggleModerator(u)}>{busyId === u.user_id ? 'En cours…' : u.adminActive ? 'Désactiver' : 'Réactiver'}</button></td></tr>)}</tbody></table></div></Card>
    {open && <Modal title={isAdmin ? 'Inviter un modérateur' : 'Inviter un administrateur'} onClose={close} confirmLabel={saving ? 'Envoi...' : 'Envoyer l’invitation'} onConfirm={() => void invite()}><div className="drawer-form"><label>Rechercher un utilisateur Scrole<input className="setting-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom ou @username" autoFocus /></label><div className="dashboard-report-list">{inviteCandidates.map(u => <button type="button" className="dashboard-report" key={u.user_id} onClick={() => setSelected(u)}><span className="dashboard-report-main"><strong>{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}</strong><small>@{u.username} · {u.email || 'e-mail non affiché'}</small></span>{selected?.user_id === u.user_id && <StatusBadge tone="success">Sélectionné</StatusBadge>}</button>)}</div><label>Rôle<select className="setting-input" value={role} onChange={e => setRole(e.target.value as InviteRole)} disabled={isAdmin}><option value="moderateur">Modérateur</option>{isSuperAdmin && <><option value="admin">Admin</option><option value="super_admin">Super Admin</option></>}</select></label>{error && <span className="field-error" role="alert">{error}</span>}</div></Modal>}
  </>
}

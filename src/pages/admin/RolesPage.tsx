import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

type Role = { id: string; name: string; slug: string; description: string | null; active: boolean; created_at: string }
type RolePermission = { role_id: string; permission: string; enabled: boolean }

const permissionLabels: Record<string, string> = {
  'users.view':'Voir les utilisateurs','users.edit':'Modifier les utilisateurs','users.suspend':'Suspendre un utilisateur','users.unsuspend':'Réactiver un utilisateur','users.ban':'Bannir un utilisateur','users.unban':'Lever un bannissement',
  'communities.view':'Voir les communautés','communities.edit':'Modifier les communautés','communities.suspend':'Suspendre une communauté','communities.unsuspend':'Réactiver une communauté','communities.delete':'Supprimer une communauté',
  'posts.view':'Voir les publications','posts.edit':'Modifier les publications','posts.hide':'Masquer une publication','posts.restore':'Restaurer une publication','posts.delete':'Supprimer une publication',
  'events.view':'Voir les événements','events.edit':'Modifier les événements','events.suspend':'Suspendre un événement','events.restore':'Restaurer un événement','events.delete':'Supprimer un événement',
  'reports.view':'Voir les signalements','reports.assign':'Assigner un signalement','reports.resolve':'Résoudre un signalement','reports.reject':'Rejeter un signalement',
  'administrators.view':'Voir les administrateurs','administrators.create':'Inviter un administrateur','administrators.edit':'Modifier un administrateur','administrators.disable':'Désactiver un administrateur','administrators.manage_roles':'Gérer les rôles',
  'system.view':'Voir le système','settings.edit':'Modifier les paramètres','certifications.manage':'Gérer les certifications','roles.manage':'Gérer les rôles','permissions.manage':'Gérer les permissions','activity.view':'Voir l’activité',
}

export function RolesPage() {
  const { user } = useAuth()
  const canManage = user?.role === 'Super Admin'
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<{ id?: string; name: string; slug: string; description: string; active: boolean } | null>(null)

  const load = async () => {
    setLoading(true); setError('')
    const [roleResult, permissionResult] = await Promise.all([
      supabase.from('admin_custom_roles').select('id,name,slug,description,active,created_at').order('created_at'),
      supabase.from('admin_custom_role_permissions').select('role_id,permission,enabled'),
    ])
    if (roleResult.error) setError(roleResult.error.message)
    else setRoles(roleResult.data ?? [])
    if (permissionResult.error) setError(permissionResult.error.message)
    else setPermissions(permissionResult.data ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const filteredRoles = useMemo(() => roles.filter(role => `${role.name} ${role.slug} ${role.description ?? ''}`.toLowerCase().includes(search.toLowerCase().trim())), [roles, search])
  const selected = roles.find(role => role.id === selectedId) ?? filteredRoles[0] ?? null
  const selectedPermissions = useMemo(() => permissions.filter(item => item.role_id === selected?.id), [permissions, selected])
  const enabledCount = selectedPermissions.filter(item => item.enabled).length

  useEffect(() => { if (selected && selected.id !== selectedId) setSelectedId(selected.id) }, [selected?.id])

  const openCreate = () => setEditor({ name: '', slug: '', description: '', active: true })
  const openEdit = () => { if (selected) setEditor({ id: selected.id, name: selected.name, slug: selected.slug, description: selected.description ?? '', active: selected.active }) }
  const saveRole = async () => {
    if (!editor || !canManage) return
    const name = editor.name.trim(); const slug = editor.slug.trim().toLowerCase(); const description = editor.description.trim() || null
    if (name.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setError('Le nom et le slug du rôle sont invalides.'); return }
    setSaving(true); setError('')
    const payload = { name, slug, description, active: editor.active }
    const result = editor.id ? await supabase.from('admin_custom_roles').update(payload).eq('id', editor.id).select().single() : await supabase.from('admin_custom_roles').insert(payload).select().single()
    if (result.error) setError(result.error.message)
    else { setRoles(current => editor.id ? current.map(role => role.id === editor.id ? result.data : role) : [...current, result.data]); setSelectedId(result.data.id); setEditor(null); setMessage(editor.id ? 'Rôle modifié.' : 'Rôle créé.'); window.setTimeout(() => setMessage(''), 2400) }
    setSaving(false)
  }
  const toggleActive = async () => {
    if (!selected || !canManage) return
    const next = !selected.active; setSaving(true); setError('')
    const result = await supabase.from('admin_custom_roles').update({ active: next }).eq('id', selected.id).select().single()
    if (result.error) setError(result.error.message)
    else { setRoles(current => current.map(role => role.id === selected.id ? result.data : role)); setMessage(next ? 'Rôle activé.' : 'Rôle désactivé.'); window.setTimeout(() => setMessage(''), 2400) }
    setSaving(false)
  }
  const togglePermission = async (permission: string) => {
    if (!selected || !canManage || saving) return
    const current = selectedPermissions.find(item => item.permission === permission)?.enabled ?? false
    setSaving(true); setError('')
    const result = await supabase.from('admin_custom_role_permissions').upsert({ role_id: selected.id, permission, enabled: !current, updated_at: new Date().toISOString() })
    if (result.error) setError(result.error.message)
    else setPermissions(items => { const exists = items.some(item => item.role_id === selected.id && item.permission === permission); return exists ? items.map(item => item.role_id === selected.id && item.permission === permission ? { ...item, enabled: !current } : item) : [...items, { role_id: selected.id, permission, enabled: !current }] })
    setSaving(false)
  }

  return <div className="roles-page">
    <header className="admin-page-header"><div><span className="admin-page-eyebrow">Administration</span><h1>Rôles</h1><p>Créez des rôles personnalisés et définissez précisément leurs permissions.</p></div><ScroleButton onClick={openCreate} disabled={!canManage}>+ Nouveau rôle</ScroleButton></header>
    {message && <div className="toast-message" role="status">{message}</div>}
    {error && <div className="field-error" role="alert">{error}</div>}
    <div className="roles-layout">
      <Card className="roles-list-card"><div className="roles-list-header"><div><strong>Rôles disponibles</strong><span>{filteredRoles.length} rôle{filteredRoles.length > 1 ? 's' : ''}</span></div><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un rôle" /></label></div>{loading ? <div className="table-empty">Chargement des rôles…</div> : <div className="roles-list">{filteredRoles.map(role => <button type="button" key={role.id} className={`role-list-item ${selected?.id === role.id ? 'active' : ''}`} onClick={() => setSelectedId(role.id)}><span className="role-list-icon">◆</span><span><strong>{role.name}</strong><small>{role.description || 'Aucune description'}</small></span><StatusBadge tone={role.active ? 'success' : 'neutral'}>{role.active ? 'Actif' : 'Inactif'}</StatusBadge></button>)}{!filteredRoles.length && <div className="table-empty">Aucun rôle trouvé.</div>}</div>}</Card>
      {selected && <Card className="role-detail-card"><div className="role-detail-head"><div><div className="role-detail-title"><h2>{selected.name}</h2><StatusBadge tone={selected.active ? 'success' : 'neutral'}>{selected.active ? 'Actif' : 'Inactif'}</StatusBadge></div><p>{selected.description || 'Aucune description.'}</p><code>{selected.slug}</code></div><div className="role-actions"><ScroleButton variant="secondary" onClick={openEdit} disabled={!canManage}>Modifier</ScroleButton><ScroleButton variant={selected.active ? 'danger' : 'secondary'} onClick={() => void toggleActive()} disabled={!canManage || saving}>{selected.active ? 'Désactiver' : 'Activer'}</ScroleButton></div></div><div className="role-stat-strip"><div><strong>{enabledCount}</strong><span>permissions actives</span></div><div><strong>{selectedPermissions.length}</strong><span>permissions configurées</span></div></div><div className="role-permissions-head"><div><h3>Permissions du rôle</h3><p>Activez ou désactivez les accès associés à ce rôle.</p></div></div><div className="role-permission-grid">{Object.keys(permissionLabels).map(permission => { const active = selectedPermissions.find(item => item.permission === permission)?.enabled ?? false; return <div className="role-permission-item" key={permission}><div><strong>{permissionLabels[permission]}</strong><code>{permission}</code></div><button type="button" className={`permission-switch ${active ? 'enabled' : ''}`} aria-pressed={active} disabled={!canManage || saving} onClick={() => void togglePermission(permission)}><span /></button></div>})}</div></Card>}
    </div>
    {!canManage && <div className="roles-readonly-note">La gestion des rôles est réservée au Super Admin. Vous pouvez consulter les rôles et leurs permissions.</div>}
    {editor && <Modal title={editor.id ? 'Modifier le rôle' : 'Créer un rôle'} onClose={() => setEditor(null)} confirmLabel={saving ? 'Enregistrement…' : editor.id ? 'Enregistrer' : 'Créer le rôle'} onConfirm={() => void saveRole()}><div className="role-editor-form"><label>Nom du rôle<input className="input" value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} placeholder="Ex. Responsable communauté" /></label><label>Identifiant (slug)<input className="input" value={editor.slug} onChange={e => setEditor({ ...editor, slug: e.target.value })} placeholder="responsable-communaute" /><small>Minuscules, chiffres et tirets uniquement.</small></label><label>Description<textarea className="input role-editor-textarea" value={editor.description} onChange={e => setEditor({ ...editor, description: e.target.value })} placeholder="Décrivez le rôle et son périmètre." /></label><label className="role-editor-check"><input type="checkbox" checked={editor.active} onChange={e => setEditor({ ...editor, active: e.target.checked })} /> Rôle actif</label></div></Modal>}
  </div>
}

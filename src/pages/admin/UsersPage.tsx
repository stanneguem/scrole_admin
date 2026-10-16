import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import './UserAdminPolish.css'

type DirectoryUser = {
  user_id: string
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  photo_url?: string | null
  account_status?: string | null
  is_verified?: boolean | null
  created_at?: string | null
  email?: string | null
  last_sign_in_at?: string | null
}
const formatDate=(value?:string|null)=>value?new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(value)):'—'
const initials=(first?:string|null,last?:string|null,username?:string|null)=>[first,last].filter(Boolean).map(v=>v![0]).join('').slice(0,2).toUpperCase()||username?.slice(0,2).toUpperCase()||'SC'

export function UsersPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { hasPermission } = useAuth()
  const canViewUsers = hasPermission('users.view')
  const canEditUsers = hasPermission('users.edit')
  const [users,setUsers]=useState<DirectoryUser[]>([]);const [query,setQuery]=useState('');const [loading,setLoading]=useState(true);const [error,setError]=useState('')
  useEffect(()=>{if(!canViewUsers){setUsers([]);setLoading(false);return}let cancelled=false;const load=async()=>{setLoading(true);setError('');const {data,error:invokeError}=await supabase.functions.invoke('admin-user-directory',{body:{action:'search',query}});if(cancelled)return;if(invokeError||!data?.success)setError(invokeError?.message??data?.message??'Impossible de charger les utilisateurs.');else setUsers((data.users??[]) as DirectoryUser[]);setLoading(false)};const timer=window.setTimeout(()=>void load(),250);return()=>{cancelled=true;window.clearTimeout(timer)}},[query,canViewUsers])
  if(!canViewUsers)return <Card><div className="table-empty users-empty"><strong>Accès non autorisé</strong><p>La permission « Voir les utilisateurs » est désactivée pour votre rôle.</p></div></Card>
  return <><header className="admin-page-header"><div><h1>Utilisateurs</h1><p>Consultez les comptes Scrole et ouvrez leur dossier complet.</p></div><div className="admin-page-actions"><ScroleButton variant="secondary" onClick={()=>onNavigate('/admin')}>Retour au dashboard</ScroleButton></div></header><Card className="resource-card users-page-card"><div className="users-page-toolbar"><label className="search-field users-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Rechercher par nom ou username" aria-label="Rechercher un utilisateur"/></label><span className="result-count users-result-count">{users.length} résultat{users.length>1?'s':''}</span></div>{loading?<div className="table-empty users-empty">Chargement des utilisateurs…</div>:error?<div className="table-empty users-empty"><strong>Erreur</strong><p>{error}</p></div>:<div className="table-scroll"><table className="admin-table users-table"><thead><tr><th>Utilisateur</th><th>Statut</th><th>Vérification</th><th>Inscription</th><th>Dernière connexion</th>{canEditUsers&&<th>Action</th>}</tr></thead><tbody>{users.map(user=>{const name=[user.first_name,user.last_name].filter(Boolean).join(' ')||user.username||user.user_id;return <tr key={user.user_id} onClick={()=>onNavigate(`/admin/users/${user.user_id}`)}><td><div className="user-table-identity">{user.photo_url?<img className="user-table-avatar-image" src={user.photo_url} alt=""/>:<span className="user-table-avatar" aria-hidden="true">{initials(user.first_name,user.last_name,user.username)}</span>}<div><strong>{name}</strong><small>@{user.username||'—'} · {user.email||'email non renseigné'}</small></div></div></td><td><StatusBadge tone={user.account_status==='active'?'success':'danger'}>{user.account_status||'Inconnu'}</StatusBadge></td><td>{user.is_verified?'✓ Vérifié':'Non vérifié'}</td><td>{formatDate(user.created_at)}</td><td>{formatDate(user.last_sign_in_at)}</td>{canEditUsers&&<td><button type="button" className="table-action" onClick={event=>{event.stopPropagation();onNavigate(`/admin/users/${user.user_id}`)}}>Voir le profil</button></td>}</tr>})}</tbody></table>{users.length===0&&<div className="table-empty users-empty">Aucun utilisateur trouvé.</div>}</div>}</Card></>
}

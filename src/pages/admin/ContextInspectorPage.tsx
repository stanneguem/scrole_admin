import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { scroleUsers } from '../../mocks/adminData'
import type { ResourceKey } from '../../types/admin'
import { getActionsFor, getPostById, getUserById, moderatePost, resolveReport, useMockStore } from '../../services/mockStore'

const images: Record<string, string> = {
  communities: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=80',
  posts: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80',
  events: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1400&q=80',
  reports: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80',
}
const labels: Record<ResourceKey, string> = { reports: 'Report Inspector', users: 'User Inspector', communities: 'Community Inspector', posts: 'Post Inspector', events: 'Event Inspector', administrators: 'Administrator Inspector', roles: 'Role Inspector', permissions: 'Permission Inspector', activity: 'Activity Inspector', 'moderation-actions': 'Moderation Inspector', 'hidden-content': 'Content Inspector' }

type ContextResource = 'reports' | 'communities' | 'posts' | 'events'
type ContextInspectorPageProps = { resource: ContextResource; id: string; onNavigate: (path: string) => void }

export function ContextInspectorPage({ resource, id, onNavigate }: ContextInspectorPageProps) {
  const store = useMockStore()
  const record = store.resources[resource].find((item) => item.id === id)
  const [modal, setModal] = useState(false)
  const [message, setMessage] = useState('')
  if (!record) return <Card><div className="table-empty"><strong>Élément introuvable</strong><p>Cette entité n’existe pas dans les données mockées.</p><ScroleButton onClick={() => onNavigate(`/admin/${resource}`)}>Retour à la liste</ScroleButton></div></Card>
  const linkedUser = resource === 'posts' ? getUserById(scroleUsers[0].id) : scroleUsers[0]
  const user = linkedUser ?? scroleUsers[0]
  const post = resource === 'posts' ? getPostById(id) : user.posts[0]
  const actions = getActionsFor(isResourceLabel(resource), id)
  const isReport = resource === 'reports'
  const isPost = resource === 'posts'
  const isCommunity = resource === 'communities'
  const isEvent = resource === 'events'
  const actionLabel = isReport ? 'Traiter le signalement' : record.status === 'Suspendu' || record.status === 'Masqué' ? 'Restaurer' : isPost ? 'Masquer la publication' : 'Suspendre'
  const executeAction = () => { setModal(false); if (isPost) moderatePost(id, record.status === 'Masqué' ? 'restore' : 'hide', 'Décision manuelle', 'Action depuis le Post Inspector.'); setMessage(`${actionLabel} enregistré pour ${record.title}.`); window.setTimeout(() => setMessage(''), 2600) }
  const handleReportDecision = (decision: string, reason: string, note: string) => { const report = store.resources.reports.find((item) => item.id === id); const targetPostId = report?.title.match(/#([A-Z]+-\d+)/)?.[1]; if (targetPostId && decision === 'Masquer le contenu') moderatePost(targetPostId, 'hide', reason, note, id); else if (targetPostId && decision === 'Supprimer le contenu') moderatePost(targetPostId, 'delete', reason, note, id); else resolveReport(id, decision, reason, note); setModal(false); setMessage(decision === 'Rejeter le signalement' ? 'Signalement rejeté.' : `Signalement traité : ${decision.toLowerCase()}.`); window.setTimeout(() => setMessage(''), 2600) }
  return <>
    <header className="admin-page-header"><div><button type="button" className="back-action" onClick={() => onNavigate(`/admin/${resource}`)}>← Retour à la liste</button><h1>{labels[resource]}</h1><p>{record.id} · {record.category} · {record.date}</p></div><div className="admin-page-actions"><ScroleButton variant="secondary" onClick={() => onNavigate(`/admin/users/${user.id}`)}>Voir l’utilisateur lié</ScroleButton><ScroleButton variant="danger" onClick={() => setModal(true)}>{actionLabel}</ScroleButton></div></header>
    {message && <div className="toast-message" role="status">{message}</div>}
    <section className="entity-inspector-hero"><div className="entity-cover" style={{ backgroundImage: `url(${images[resource]})` }} /><div className="entity-hero-copy"><div><span className="auth-eyebrow">{isReport ? 'Décision à contextualiser' : 'Entité Scrole'}</span><h2>{record.title}</h2><p>{record.subtitle}</p></div><StatusBadge tone={record.status === 'Actif' || record.status === 'Résolu' ? 'success' : record.status === 'Ouvert' || record.status === 'En attente' ? 'warning' : 'danger'}>{record.status}</StatusBadge></div></section>
    <div className="inspector-layout context-layout"><div className="inspector-main"><Card title={isReport ? 'Informations du signalement' : isPost ? 'Publication' : isCommunity ? 'Communauté' : isEvent ? 'Événement' : 'Contexte'}><div className="context-content">{isReport && <div className="report-context-banner"><strong>Motif : {record.subtitle}</strong><span>{record.meta} · priorité haute · créé le {record.date}</span></div>}<p>{record.detail}.</p>{isPost && <div className="post-body-preview">{post?.text ?? user.posts[0].text}</div>}{isCommunity && <p>Cette communauté réunit des membres autour de pratiques communes. Les règles, membres et publications associés doivent être examinés avant toute décision.</p>}{isEvent && <p>Événement organisé par {record.meta}. Consultez les participants, la communauté et les signalements associés avant d’agir.</p>}</div></Card><Card title="Historique de modération"><div className="timeline"><div><span className="timeline-dot" /><p><strong>Entité créée</strong><small>{record.date}</small></p></div>{actions.map((item) => <div key={item.id}><span className="timeline-dot" /><p><strong>{item.action}</strong><small>{item.date} · {item.moderator}</small><small>{item.reason} · {item.note}</small></p></div>)}</div></Card></div><div className="inspector-side"><Card title={isReport ? 'Utilisateur signalé' : 'Auteur / propriétaire'}><button type="button" className="context-user-card" onClick={() => onNavigate(`/admin/users/${user.id}`)}><img src={user.avatar} alt="" /><span><strong>{user.name}</strong><small>@{user.username}</small><small>{user.accountType} · {user.status}</small></span><span className="context-arrow">→</span></button></Card><Card title={isReport ? 'Communauté concernée' : 'Relations'}><button type="button" className="context-relation" onClick={() => onNavigate('/admin/communities/COM-0312')}><img src={user.communities[0].image} alt="" /><span><strong>{user.communities[0].name}</strong><small>@{user.communities[0].slug} · {user.communities[0].members.toLocaleString('fr-FR')} membres</small></span></button><div className="context-links"><button type="button" onClick={() => onNavigate(`/admin/posts/${user.posts[0].id}`)}>Voir les publications liées →</button><button type="button" onClick={() => onNavigate(`/admin/reports/${user.reports[0].id}`)}>Voir les signalements →</button></div></Card></div></div>
    {modal && isReport ? <ReportDecisionModal onClose={() => setModal(false)} onDecision={handleReportDecision} /> : modal && <Modal title={`Confirmer : ${actionLabel}`} onClose={() => setModal(false)} confirmLabel="Confirmer l’action" danger onConfirm={executeAction}><p>Vous êtes sur le point d’agir sur <strong>{record.title}</strong>.</p><p>Le contexte de l’auteur, de la communauté et de l’historique est disponible avant confirmation.</p></Modal>}
  </>
}

function isResourceLabel(resource: ContextResource) { return resource === 'reports' ? 'Signalement' : resource === 'posts' ? 'Publication' : resource }

function ReportDecisionModal({ onClose, onDecision }: { onClose: () => void; onDecision: (decision: string, reason: string, note: string) => void }) {
  const [decision, setDecision] = useState('Rejeter le signalement')
  const [reason, setReason] = useState('Aucune violation')
  const [note, setNote] = useState('')
  return <Modal title="Traiter le signalement" onClose={onClose} confirmLabel="Enregistrer la décision" danger onConfirm={() => onDecision(decision, reason, note)}><div className="decision-form"><p>Choisissez une décision après examen du contenu, de l’auteur et de la communauté liés.</p><label>Décision<select value={decision} onChange={(event) => setDecision(event.target.value)}><option>Rejeter le signalement</option><option>Avertir l’auteur</option><option>Masquer le contenu</option><option>Supprimer le contenu</option><option>Escalader</option></select></label><label>Raison<select value={reason} onChange={(event) => setReason(event.target.value)}><option>Aucune violation</option><option>Spam</option><option>Harcèlement</option><option>Contenu haineux</option><option>Autre</option></select></label><label>Note interne<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Expliquez la décision..." /></label></div></Modal>
}

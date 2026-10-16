import type { AdminRecord, ResourceKey, ScroleUser } from '../types/admin'

const demoCover = 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=80'
const demoAvatar = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80'
const communityImage = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=300&q=80'
const eventImage = 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=600&q=80'

export const scroleUsers: ScroleUser[] = [{
  id: 'USR-10482', name: 'Camille Robert', username: 'camille.robert', email: 'camille.robert@example.com', bio: 'Product designer, curieuse des communautés créatives et des projets qui rapprochent les gens.', country: 'France', city: 'Lyon', accountType: 'Premium', premiumUntil: '12 janvier 2027', status: 'Actif', createdAt: '12 janvier 2025', lastLogin: 'Aujourd’hui, 09:04', lastActivity: 'Aujourd’hui, 09:12', avatar: demoAvatar, cover: demoCover,
  communities: [{ id: 'COM-0312', name: 'Design produit', slug: 'design-produit', description: 'Échanger autour du product design', role: 'Membre', members: 8421, status: 'Actif', joinedAt: '12 janvier 2025', image: communityImage }, { id: 'COM-0311', name: 'Freelances France', slug: 'freelances-france', description: 'Le réseau des indépendants', role: 'Modératrice', members: 5102, status: 'Actif', joinedAt: '02 mars 2025', image: communityImage }],
  posts: [{ id: 'SC-4821', text: 'Recherche conseil pour mon portfolio : quelles études de cas vous ont vraiment aidé à convaincre ?', communityId: 'COM-0312', createdAt: 'Aujourd’hui, 09:12', reactions: 12, comments: 4, views: 184, status: 'Actif' }, { id: 'SC-4714', text: 'Merci pour les échanges pendant le meetup lyonnais. Beaucoup d’idées à poursuivre.', communityId: 'COM-0311', createdAt: '28 août 2026, 18:20', reactions: 28, comments: 9, views: 392, status: 'Actif' }],
  eventsCreated: [{ id: 'EV-871', name: 'Portfolio review Lyon', communityId: 'COM-0312', date: '20 sept. 2026', location: 'Lyon · La Cordée', participants: 34, status: 'Actif', image: eventImage }], eventsJoined: [{ id: 'EV-881', name: 'Designers meetup Nantes', communityId: 'COM-0312', date: '18 sept. 2026', location: 'Nantes', participants: 42, status: 'Actif', image: eventImage }],
  reports: [{ id: 'RPT-2048', reason: 'Harcèlement ou comportement abusif', targetId: 'SC-4821', targetType: 'Publication', status: 'Ouvert', priority: 'High', date: '06 sept. 2026, 09:42' }], moderation: [{ date: '04 sept. 2026', action: 'Avertissement émis', moderator: 'Thomas Bernard', reason: 'Échange signalé par un membre', note: 'Rappel des règles communautaires envoyé.' }],
}]

export const dashboardStats = [
  { label: 'Utilisateurs', value: '12 842', change: '+8,4 %', tone: 'positive' },
  { label: 'Communautés', value: '486', change: '+3,1 %', tone: 'positive' },
  { label: 'Publications', value: '38 219', change: '+12,7 %', tone: 'positive' },
  { label: 'Signalements ouverts', value: '27', change: '5 urgents', tone: 'warning' },
]

export const recentActivity = [
  { actor: 'Claire Martin', action: 'a résolu un signalement', target: 'Publication #SC-4821', time: 'Il y a 8 min' },
  { actor: 'Thomas Bernard', action: 'a suspendu une communauté', target: 'Designers francophones', time: 'Il y a 24 min' },
  { actor: 'Sofia Morel', action: 'a restauré une publication', target: 'Publication #SC-4816', time: 'Il y a 46 min' },
  { actor: 'Marc Dubois', action: 'a modifié un rôle', target: 'Support → Moderator', time: 'Il y a 1 h' },
]

const reports: AdminRecord[] = [
  { id: 'RPT-2048', title: 'Publication #SC-4821', subtitle: 'Harcèlement ou comportement abusif', status: 'Ouvert', meta: 'Signalé par Camille R.', detail: 'Message public dans la communauté Design produit', category: 'Publication', date: '06 sept. 2026, 09:42' },
  { id: 'RPT-2047', title: 'Profil de Lucas D.', subtitle: 'Usurpation d’identité', status: 'En attente', meta: 'Signalé par Thomas B.', detail: 'Profil utilisateur', category: 'Utilisateur', date: '06 sept. 2026, 08:57' },
  { id: 'RPT-2046', title: 'Événement #EV-881', subtitle: 'Contenu inapproprié', status: 'Ouvert', meta: 'Signalé par Nora L.', detail: 'Événement public dans Nantes créative', category: 'Événement', date: '05 sept. 2026, 18:21' },
  { id: 'RPT-2045', title: 'Publication #SC-4799', subtitle: 'Spam', status: 'Résolu', meta: 'Traité par Claire M.', detail: 'Publication dans Freelances France', category: 'Publication', date: '05 sept. 2026, 16:08' },
  { id: 'RPT-2044', title: 'Communauté Crypto France', subtitle: 'Arnaque ou fraude', status: 'Rejeté', meta: 'Traité par Marc D.', detail: 'Communauté publique', category: 'Communauté', date: '05 sept. 2026, 11:32' },
]

const users: AdminRecord[] = [
  { id: 'USR-10482', title: 'Camille Robert', subtitle: 'camille.robert@example.com', status: 'Actif', meta: '14 communautés · 3 signalements', detail: 'Membre depuis le 12 janv. 2025', category: 'Utilisateur', date: '12 janv. 2025' },
  { id: 'USR-10481', title: 'Lucas Dubois', subtitle: 'lucas.dubois@example.com', status: 'Suspendu', meta: '2 communautés · 8 signalements', detail: 'Suspension temporaire jusqu’au 12 sept.', category: 'Utilisateur', date: '03 mars 2024' },
  { id: 'USR-10480', title: 'Nora Lefèvre', subtitle: 'nora.lefevre@example.com', status: 'Actif', meta: '6 communautés · 0 signalement', detail: 'Membre depuis le 28 juin 2025', category: 'Utilisateur', date: '28 juin 2025' },
  { id: 'USR-10479', title: 'Antoine Garcia', subtitle: 'antoine.garcia@example.com', status: 'Actif', meta: '9 communautés · 1 signalement', detail: 'Membre depuis le 06 févr. 2025', category: 'Utilisateur', date: '06 févr. 2025' },
]

const communities: AdminRecord[] = [
  { id: 'COM-0312', title: 'Design produit', subtitle: 'Échanger autour du product design', status: 'Actif', meta: '8 421 membres', detail: 'Communauté publique · 2 180 publications', category: 'Communauté', date: '15 févr. 2024' },
  { id: 'COM-0311', title: 'Freelances France', subtitle: 'Le réseau des indépendants', status: 'Actif', meta: '5 102 membres', detail: 'Communauté publique · 1 340 publications', category: 'Communauté', date: '02 mars 2024' },
  { id: 'COM-0310', title: 'Crypto France', subtitle: 'Actualités et échanges crypto', status: 'Suspendu', meta: '1 884 membres', detail: 'Suspension le 05 sept. 2026', category: 'Communauté', date: '19 mai 2024' },
]

const posts: AdminRecord[] = [
  { id: 'SC-4821', title: 'Recherche conseil pour mon portfolio', subtitle: 'par Camille Robert', status: 'Actif', meta: 'Design produit', detail: '12 réactions · 4 commentaires · 0 signalement', category: 'Publication', date: 'Aujourd’hui, 09:12' },
  { id: 'SC-4820', title: 'Retour sur la conférence de Lyon', subtitle: 'par Nora Lefèvre', status: 'Masqué', meta: 'Freelances France', detail: 'Masquée par Claire Martin', category: 'Publication', date: 'Aujourd’hui, 08:45' },
  { id: 'SC-4819', title: 'Nouvelle mission product designer', subtitle: 'par Antoine Garcia', status: 'Actif', meta: 'Design produit', detail: '8 réactions · 1 commentaire · 0 signalement', category: 'Publication', date: 'Hier, 18:20' },
]

const events: AdminRecord[] = [
  { id: 'EV-881', title: 'Designers meetup Nantes', subtitle: 'Nantes · 18 sept. 2026', status: 'Actif', meta: '42 participants', detail: 'Organisé par Design produit', category: 'Événement', date: '18 sept. 2026' },
  { id: 'EV-880', title: 'Atelier freelance', subtitle: 'Paris · 22 sept. 2026', status: 'Actif', meta: '18 participants', detail: 'Organisé par Freelances France', category: 'Événement', date: '22 sept. 2026' },
  { id: 'EV-879', title: 'Crypto investment night', subtitle: 'En ligne · 10 sept. 2026', status: 'Suspendu', meta: '7 participants', detail: 'Événement suspendu pour vérification', category: 'Événement', date: '10 sept. 2026' },
]

const administrators: AdminRecord[] = [
  { id: 'ADM-004', title: 'Claire Martin', subtitle: 'claire.martin@scrole.app', status: 'Actif', meta: 'Super Admin', detail: 'Dernière activité il y a 8 min', category: 'Administrateur', date: 'Aujourd’hui' },
  { id: 'ADM-003', title: 'Thomas Bernard', subtitle: 'thomas.bernard@scrole.app', status: 'Actif', meta: 'Moderator', detail: 'Dernière activité il y a 24 min', category: 'Administrateur', date: 'Aujourd’hui' },
  { id: 'ADM-002', title: 'Sofia Morel', subtitle: 'sofia.morel@scrole.app', status: 'Actif', meta: 'Moderator', detail: 'Dernière activité il y a 46 min', category: 'Administrateur', date: 'Aujourd’hui' },
]

const roles: AdminRecord[] = [
  { id: 'ROLE-01', title: 'Super Admin', subtitle: 'Accès complet à l’administration', status: 'Actif', meta: '1 administrateur', detail: 'Toutes les permissions', category: 'Rôle', date: 'Système' },
  { id: 'ROLE-02', title: 'Admin', subtitle: 'Gestion opérationnelle de la plateforme', status: 'Actif', meta: '0 administrateur', detail: 'Toutes les permissions sauf sécurité', category: 'Rôle', date: 'Système' },
  { id: 'ROLE-03', title: 'Moderator', subtitle: 'Traitement des contenus et signalements', status: 'Actif', meta: '2 administrateurs', detail: 'Permissions de modération', category: 'Rôle', date: 'Système' },
  { id: 'ROLE-04', title: 'Support', subtitle: 'Assistance et consultation', status: 'Actif', meta: '0 administrateur', detail: 'Permissions de consultation', category: 'Rôle', date: 'Système' },
]

const permissions: AdminRecord[] = ['users.view', 'users.suspend', 'users.ban', 'communities.view', 'communities.suspend', 'posts.view', 'posts.hide', 'posts.delete', 'reports.view', 'reports.assign', 'reports.resolve', 'events.view'].map((permission, index) => ({ id: `PERM-${index + 1}`, title: permission, subtitle: 'Permission système', status: 'Actif', meta: index < 4 ? '4 rôles' : '2 rôles', detail: 'Disponible pour le futur contrôle RBAC', category: 'Permission', date: 'Système' }))
const activity: AdminRecord[] = recentActivity.map((item, index) => ({ id: `ACT-${index + 1}`, title: item.action, subtitle: item.actor, status: 'Actif', meta: item.target, detail: 'Action administrative enregistrée', category: 'Activité', date: item.time }))
const moderationActions: AdminRecord[] = reports.map((report, index) => ({ id: `MOD-${index + 1}`, title: report.status === 'Résolu' ? 'Signalement résolu' : 'Signalement examiné', subtitle: 'Claire Martin', status: 'Actif', meta: report.id, detail: report.subtitle, category: 'Modération', date: report.date }))
const hiddenContent = posts.filter((post) => post.status === 'Masqué')

export const resourceData: Record<ResourceKey, AdminRecord[]> = { reports, users, communities, posts, events, administrators, roles, permissions, activity, 'moderation-actions': moderationActions, 'hidden-content': hiddenContent }
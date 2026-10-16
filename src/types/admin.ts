import type { Permission } from './auth'

export type ResourceKey = 'reports' | 'users' | 'communities' | 'posts' | 'events' | 'administrators' | 'roles' | 'permissions' | 'activity' | 'moderation-actions' | 'hidden-content' | 'activities-validation'
export type RecordStatus = 'Ouvert' | 'En attente' | 'Résolu' | 'Rejeté' | 'Actif' | 'Suspendu' | 'Masqué' | 'Brouillon'

export type AdminRecord = {
  id: string
  title: string
  subtitle: string
  status: RecordStatus
  meta: string
  detail: string
  category: string
  date: string
}

export type AdminNavItem = { label: string; path: string; icon: string; requiredPermission?: Permission }

export type ModerationEntry = { date: string; action: string; moderator: string; reason: string; note: string }
export type ScroleCommunity = { id: string; name: string; slug: string; description: string; role: string; members: number; status: RecordStatus; joinedAt: string; image: string }
export type ScrolePost = { id: string; text: string; communityId: string; createdAt: string; reactions: number; comments: number; views: number; status: RecordStatus }
export type ScroleEvent = { id: string; name: string; communityId: string; date: string; location: string; participants: number; status: RecordStatus; image: string }
export type ScroleReport = { id: string; reason: string; targetId: string; targetType: string; status: RecordStatus; priority: 'Low' | 'Normal' | 'High' | 'Critical'; date: string }
export type ScroleUser = { id: string; name: string; username: string; email: string; bio: string; country: string; city: string; accountType: 'Standard' | 'Premium'; premiumUntil?: string; status: RecordStatus; createdAt: string; lastLogin: string; lastActivity: string; avatar: string; cover: string; communities: ScroleCommunity[]; posts: ScrolePost[]; eventsCreated: ScroleEvent[]; eventsJoined: ScroleEvent[]; reports: ScroleReport[]; moderation: ModerationEntry[] }
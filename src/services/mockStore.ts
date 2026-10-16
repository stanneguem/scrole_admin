import { useSyncExternalStore } from 'react'
import { resourceData, scroleUsers } from '../mocks/adminData'
import type { AdminRecord, ModerationEntry, ResourceKey, ScrolePost, ScroleReport, ScroleUser } from '../types/admin'

type ModerationAction = ModerationEntry & { id: string; targetType: string; targetId: string; reportId?: string }

type MockState = {
  resources: Record<ResourceKey, AdminRecord[]>
  users: ScroleUser[]
  actions: ModerationAction[]
}

const state: MockState = {
  resources: Object.fromEntries(Object.entries(resourceData).map(([key, records]) => [key, [...records]])) as Record<ResourceKey, AdminRecord[]>,
  users: scroleUsers.map((user) => ({ ...user, communities: [...user.communities], posts: [...user.posts], eventsCreated: [...user.eventsCreated], eventsJoined: [...user.eventsJoined], reports: [...user.reports], moderation: [...user.moderation] })),
  actions: [],
}
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) }
const getSnapshot = () => state

export function useMockStore() { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot) }
export function getUserById(id: string) { return state.users.find((user) => user.id === id) ?? null }
export function getResourceById(resource: ResourceKey, id: string) { return state.resources[resource].find((record) => record.id === id) ?? null }
export function getPostById(id: string): ScrolePost | null { return state.users.flatMap((user) => user.posts).find((post) => post.id === id) ?? null }
export function getReportById(id: string): ScroleReport | null { const report = state.resources.reports.find((item) => item.id === id); if (!report) return null; return { id: report.id, reason: report.subtitle, targetId: report.title.replace('Publication #', ''), targetType: report.category, status: report.status, priority: report.id === 'RPT-2048' ? 'High' : 'Normal', date: report.date } }

export function moderatePost(postId: string, action: 'hide' | 'restore' | 'delete', reason: string, note: string, reportId?: string) {
  const post = getPostById(postId)
  if (!post) return false
  const nextStatus = action === 'restore' ? 'Actif' : action === 'hide' ? 'Masqué' : 'Rejeté'
  const owner = state.users.find((user) => user.posts.some((item) => item.id === postId))
  for (const user of state.users) user.posts = user.posts.map((item) => item.id === postId ? { ...item, status: nextStatus } : item)
  state.resources.posts = state.resources.posts.map((item) => item.id === postId ? { ...item, status: nextStatus, detail: `${item.detail} · ${action === 'delete' ? 'Supprimée' : action === 'hide' ? 'Masquée' : 'Restaurée'} par Claire Martin` } : item)
  const actionLabel = action === 'delete' ? 'Publication supprimée' : action === 'hide' ? 'Publication masquée' : 'Publication restaurée'
  recordAction('Publication', postId, actionLabel, reason, note, reportId)
  if (owner) owner.moderation = [{ date: 'À l’instant', action: actionLabel, moderator: 'Claire Martin', reason, note }, ...owner.moderation]
  if (reportId) resolveReport(reportId, action === 'delete' ? 'Contenu supprimé' : action === 'hide' ? 'Contenu masqué' : 'Aucune violation', reason, note)
  notify()
  return true
}

export function resolveReport(reportId: string, decision: string, reason: string, note: string) {
  state.resources.reports = state.resources.reports.map((item) => item.id === reportId ? { ...item, status: decision === 'Rejeter le signalement' ? 'Rejeté' : 'Résolu', detail: `${item.detail} · Décision : ${decision}` } : item)
  recordAction('Signalement', reportId, decision, reason, note, reportId)
  notify()
}

export function updateResourceStatus(resource: ResourceKey, id: string, status: AdminRecord['status']) {
  state.resources[resource] = state.resources[resource].map((item) => item.id === id ? { ...item, status } : item)
  notify()
}

function recordAction(targetType: string, targetId: string, action: string, reason: string, note: string, reportId?: string) {
  state.actions = [{ id: `MOD-${Date.now()}`, targetType, targetId, action, reason, note, moderator: 'Claire Martin', date: 'À l’instant', reportId }, ...state.actions]
}

export function getActionsFor(targetType: string, targetId: string) { return state.actions.filter((action) => action.targetType === targetType && action.targetId === targetId) }

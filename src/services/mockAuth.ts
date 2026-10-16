import type { AuthUser, Permission } from '../types/auth'

const sessionKey = 'scrole-admin-session'
const sessionDuration = 8 * 60 * 60 * 1000
const allPermissions: Permission[] = [
  'users.view', 'users.edit', 'users.suspend', 'users.unsuspend', 'users.ban', 'users.unban',
  'communities.view', 'communities.edit', 'communities.suspend', 'communities.unsuspend', 'communities.delete',
  'posts.view', 'posts.edit', 'posts.hide', 'posts.restore', 'posts.delete',
  'events.view', 'events.edit', 'events.suspend', 'events.restore', 'events.delete',
  'reports.view', 'reports.assign', 'reports.resolve', 'reports.reject',
  'administrators.view', 'administrators.create', 'administrators.edit', 'administrators.disable', 'administrators.manage_roles',
  'system.view', 'settings.edit',
]

export function getStoredSession(): AuthUser | null {
  const raw = window.localStorage.getItem(sessionKey) ?? window.sessionStorage.getItem(sessionKey)
  if (!raw) return null
  try {
    const user = JSON.parse(raw) as AuthUser
    if (user.expiresAt <= Date.now()) {
      clearStoredSession()
      return null
    }
    return user
  } catch {
    clearStoredSession()
    return null
  }
}

export function createMockSession(email: string, rememberMe: boolean): AuthUser {
  const user: AuthUser = { id: 'ADM-004', name: 'Claire Martin', email, role: 'Super Admin', permissions: allPermissions, expiresAt: Date.now() + sessionDuration }
  const storage = rememberMe ? window.localStorage : window.sessionStorage
  storage.setItem(sessionKey, JSON.stringify(user))
  return user
}

export function clearStoredSession() {
  window.localStorage.removeItem(sessionKey)
  window.sessionStorage.removeItem(sessionKey)
}

export function hasMockPermission(user: AuthUser | null, permission: Permission) {
  return Boolean(user?.permissions.includes(permission))
}
import type { Permission, Role } from '../types/auth'

const moderatorPermissions: Permission[] = [
  'users.view', 'users.suspend', 'users.unsuspend', 'users.ban', 'users.unban',
  'communities.view', 'communities.suspend', 'communities.unsuspend',
  'posts.view', 'posts.hide', 'posts.restore',
  'events.view', 'events.suspend', 'events.restore',
  'reports.view', 'reports.assign', 'reports.resolve', 'reports.reject',
  'system.view',
]

const rolePermissions: Record<Role, Permission[]> = {
  Moderator: moderatorPermissions,
  Admin: [...moderatorPermissions, 'administrators.view', 'administrators.create', 'administrators.edit', 'administrators.disable'],
  'Super Admin': [
    'users.view', 'users.edit', 'users.suspend', 'users.unsuspend', 'users.ban', 'users.unban',
    'communities.view', 'communities.edit', 'communities.suspend', 'communities.unsuspend', 'communities.delete',
    'posts.view', 'posts.edit', 'posts.hide', 'posts.restore', 'posts.delete',
    'events.view', 'events.edit', 'events.suspend', 'events.restore', 'events.delete',
    'reports.view', 'reports.assign', 'reports.resolve', 'reports.reject',
    'administrators.view', 'administrators.create', 'administrators.edit', 'administrators.disable', 'administrators.manage_roles',
    'system.view', 'settings.edit',
  ],
}

export function permissionsForRole(role: Role): Permission[] {
  return rolePermissions[role] ?? []
}

export function hasRolePermission(role: Role | null | undefined, permission: Permission): boolean {
  return Boolean(role && rolePermissions[role]?.includes(permission))
}

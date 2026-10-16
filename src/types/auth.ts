export type Permission =
  | 'users.view' | 'users.edit' | 'users.suspend' | 'users.unsuspend' | 'users.ban' | 'users.unban'
  | 'communities.view' | 'communities.edit' | 'communities.suspend' | 'communities.unsuspend' | 'communities.delete'
  | 'posts.view' | 'posts.edit' | 'posts.hide' | 'posts.restore' | 'posts.delete'
  | 'events.view' | 'events.edit' | 'events.suspend' | 'events.restore' | 'events.delete'
  | 'reports.view' | 'reports.assign' | 'reports.resolve' | 'reports.reject'
  | 'administrators.view' | 'administrators.create' | 'administrators.edit' | 'administrators.disable' | 'administrators.manage_roles'
  | 'system.view' | 'settings.edit'
  | 'certifications.manage' | 'certifications.gift' | 'roles.manage' | 'permissions.manage' | 'activity.view' | 'activities.validate'

export type Role = 'Super Admin' | 'Admin' | 'Moderator'

export type AdminProfile = {
  firstName: string
  lastName: string
  phone: string
  photoUrl: string
  functionTitle: string
  bio: string
}

export type AuthUser = {
  id: string
  name: string
  email: string
  role: Role
  permissions: Permission[]
  expiresAt: number
  profileComplete: boolean
  profile: AdminProfile
}

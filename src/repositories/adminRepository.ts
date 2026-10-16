import type { AdminRecord, ResourceKey } from '../types/admin'

export type ListQuery = { search?: string; status?: string; page?: number; pageSize?: number }
export type ListResult<T> = { data: T[]; total: number }

export interface AdminRepository {
  list(resource: ResourceKey, query?: ListQuery): Promise<ListResult<AdminRecord>>
  get(resource: ResourceKey, id: string): Promise<AdminRecord | null>
  updateStatus(resource: ResourceKey, id: string, status: AdminRecord['status']): Promise<AdminRecord | null>
}

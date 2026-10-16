import { resourceData } from '../mocks/adminData'
import type { AdminRepository, ListQuery, ListResult } from '../repositories/adminRepository'
import type { AdminRecord, ResourceKey } from '../types/admin'

const mockRepository: AdminRepository = {
  async list(resource: ResourceKey, query: ListQuery = {}): Promise<ListResult<AdminRecord>> {
    const search = query.search?.toLowerCase() ?? ''
    const filtered = resourceData[resource].filter((record) => `${record.title} ${record.subtitle} ${record.id}`.toLowerCase().includes(search) && (!query.status || record.status === query.status))
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    return { data: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length }
  },
  async get(resource, id) { return resourceData[resource].find((record) => record.id === id) ?? null },
  async updateStatus(resource, id, status) { return resourceData[resource].find((record) => record.id === id) ? { ...resourceData[resource].find((record) => record.id === id), status } as AdminRecord : null },
}

export const adminService = {
  list: (resource: ResourceKey, query?: ListQuery) => mockRepository.list(resource, query),
  get: (resource: ResourceKey, id: string) => mockRepository.get(resource, id),
  updateStatus: (resource: ResourceKey, id: string, status: AdminRecord['status']) => mockRepository.updateStatus(resource, id, status),
}

import { supabase } from '../lib/supabase'

export type PendingActivity = {
  id: string
  name: string
  base_price: number
  status: string
  event_only: boolean
  created_at: string
  creator_id: string
  creator: {
    username: string | null
    first_name: string | null
    last_name: string | null
    photo_url: string | null
  } | null
}

export interface ActivityValidationRepository {
  listPending(): Promise<PendingActivity[]>
  listAll(): Promise<PendingActivity[]>
  validate(id: string): Promise<void>
  reject(id: string, reason: string): Promise<void>
}

export const activityValidationRepository: ActivityValidationRepository = {
  async listAll() {
    const { data, error } = await supabase.rpc('admin_lister_activites')

    if (error) {
      throw new Error(error.message || 'Impossible de charger les activités en attente.')
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      base_price: Number(row.base_price),
      status: row.status,
      event_only: Boolean(row.event_only),
      created_at: row.created_at,
      creator_id: row.creator_id,
      creator: {
        username: row.username ?? null,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        photo_url: row.photo_url ?? null,
      },
    }))
  },

  async listPending() {
    const all = await this.listAll()
    return all.filter(item => item.status === 'en_attente')
  },

  async validate(id) {
    const { error } = await supabase.rpc('valider_activite', { p_id: id })
    if (error) throw new Error(error.message || 'La validation a échoué.')
  },

  async reject(id, reason) {
    const { error } = await supabase.rpc('rejeter_activite', {
      p_id: id,
      p_raison: reason.trim(),
    })
    if (error) throw new Error(error.message || 'Le rejet a échoué.')
  },
}

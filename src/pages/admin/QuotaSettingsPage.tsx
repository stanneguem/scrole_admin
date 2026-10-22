import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import './QuotaSettingsPage.css'

type Quota = {
  quota_key: string
  value: number
  label: string
  description: string
  category: 'agenda' | 'events' | 'team' | 'subscriptions'
  min_value: number
  max_value: number
  updated_at: string
}

const categoryLabels: Record<Quota['category'], string> = {
  agenda: 'Agenda des utilisateurs',
  events: 'Création et audience des événements',
  team: 'Équipe des événements',
  subscriptions: 'Avantages inclus dans les abonnements',
}

export function QuotaSettingsPage() {
  const { user } = useAuth()
  const [quotas, setQuotas] = useState<Quota[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('admin_get_scrole_quotas')
    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }
    const rows = (data ?? []) as Quota[]
    setQuotas(rows)
    setDrafts(Object.fromEntries(rows.map(row => [row.quota_key, String(row.value)])))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const groups = useMemo(() => {
    const map = new Map<Quota['category'], Quota[]>()
    for (const quota of quotas) {
      const list = map.get(quota.category) ?? []
      list.push(quota)
      map.set(quota.category, list)
    }
    return [...map.entries()]
  }, [quotas])

  const save = async (quota: Quota) => {
    setError('')
    setMessage('')
    const raw = drafts[quota.quota_key]
    if (!raw?.trim() || !/^-?\d+$/.test(raw.trim())) {
      setError('Saisissez un nombre entier valide.')
      return
    }
    const value = Number(raw)
    if (!Number.isSafeInteger(value) || value < quota.min_value || value > quota.max_value) {
      setError(`« ${quota.label} » doit être compris entre ${quota.min_value} et ${quota.max_value}.`)
      return
    }
    setSavingKey(quota.quota_key)
    const { error: rpcError } = await supabase.rpc('admin_update_scrole_quota', {
      p_quota_key: quota.quota_key,
      p_value: value,
    })
    if (rpcError) {
      setError(rpcError.message)
      setSavingKey(null)
      return
    }
    setMessage(`Quota « ${quota.label} » enregistré : ${value}.`)
    await load()
    setSavingKey(null)
  }

  if (user?.role !== 'Super Admin' && !user?.permissions.includes('certifications.manage')) {
    return <Card><div className="table-empty"><strong>Accès réservé</strong><p>La gestion des quotas exige la permission « certifications.manage ».</p></div></Card>
  }

  return <div className="quota-settings-page">
    <header className="admin-page-header">
      <div><h1>Quotas Scrole</h1><p>Modifiez les limites métier sans publier une nouvelle version de l’application. Les valeurs sont contrôlées par Supabase.</p></div>
      <div className="admin-page-actions">
        <ScroleButton variant="secondary" onClick={() => void load()} disabled={loading || savingKey !== null}>Actualiser</ScroleButton>
      </div>
    </header>
    <Card title="À propos des quotas">
      <div className="quota-info">
        <span>Les modifications sont appliquées côté serveur et journalisées.</span>
        <span>Les certifications achetées séparément ne consomment pas le quota inclus d’un abonnement.</span>
        <span>Une valeur n’est acceptée que dans la plage autorisée pour ce paramètre.</span>
      </div>
    </Card>
    {message && <div className="toast-message" role="status">{message}</div>}
    {error && <div className="error-message" role="alert">{error}</div>}
    {loading ? <Card><p>Chargement des quotas…</p></Card> : groups.map(([category, rows]) =>
      <section className="quota-section" key={category}>
        <header><h2>{categoryLabels[category]}</h2><span>{rows.length} paramètres</span></header>
        <div className="quota-grid">
          {rows.map(quota => {
            const value = drafts[quota.quota_key] ?? String(quota.value)
            const dirty = value !== String(quota.value)
            return <Card className="quota-card" key={quota.quota_key}>
              <div className="quota-card-heading"><h3>{quota.label}</h3><span>{quota.value}</span></div>
              <p>{quota.description}</p>
              <label className="quota-input-label" htmlFor={`quota-${quota.quota_key}`}>Nouvelle valeur</label>
              <div className="quota-editor">
                <input id={`quota-${quota.quota_key}`} type="number" step="1" min={quota.min_value} max={quota.max_value}
                  value={value} onChange={event => setDrafts(current => ({ ...current, [quota.quota_key]: event.target.value }))}
                  aria-describedby={`range-${quota.quota_key}`} />
                <ScroleButton onClick={() => void save(quota)} disabled={!dirty || savingKey !== null}>
                  {savingKey === quota.quota_key ? 'Enregistrement…' : 'Enregistrer'}
                </ScroleButton>
              </div>
              <small id={`range-${quota.quota_key}`}>Valeurs autorisées : {quota.min_value} à {quota.max_value}</small>
              <small>Clé technique : <code>{quota.quota_key}</code></small>
            </Card>
          })}
        </div>
      </section>
    )}
  </div>
}

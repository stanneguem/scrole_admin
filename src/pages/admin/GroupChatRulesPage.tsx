import { useCallback, useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { supabase } from '../../lib/supabase'
import './GroupChatRulesPage.css'

type Quota = {
  quota_key: string
  value: number
  label: string
  description: string | null
  category: string
  min_value: number
  max_value: number
  updated_at?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  messaging: 'Messagerie',
  agenda: 'Agenda',
  events: 'Événements',
  team: 'Équipes',
  subscriptions: 'Abonnements',
}

export function GroupChatRulesPage() {
  const [quota, setQuota] = useState<Quota | null>(null)
  const [draftValue, setDraftValue] = useState('3')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_get_scrole_quotas')
      if (rpcError) throw rpcError
      const rows = (Array.isArray(data) ? data : []) as Quota[]
      const row = rows.find((item) => item.quota_key === 'group_chat_min_active_members')
      if (!row) throw new Error('Le paramètre group_chat_min_active_members est absent. Appliquez d’abord la migration Supabase.')
      setQuota(row)
      setDraftValue(String(row.value))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les règles de groupe.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!quota) return
    const next = Number(draftValue)
    if (!Number.isInteger(next) || next < quota.min_value || next > quota.max_value) {
      setError(`Saisissez un nombre entier entre ${quota.min_value} et ${quota.max_value}.`)
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const { error: rpcError } = await supabase.rpc('admin_update_scrole_quota', {
        p_quota_key: quota.quota_key,
        p_value: next,
      })
      if (rpcError) throw rpcError
      setQuota({ ...quota, value: next })
      setMessage('Règle enregistrée. Elle s’applique aux activations futures.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer la règle.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="group-chat-rules-page">
    <header className="admin-page-header">
      <div>
        <h1>Règles des discussions de groupe</h1>
        <p>Configurez le nombre minimal de membres actifs requis avant d’autoriser l’envoi de messages.</p>
      </div>
      <ScroleButton onClick={() => void save()} disabled={loading || saving || !quota || draftValue === String(quota.value)}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </ScroleButton>
    </header>
    {message && <div className="toast-message" role="status">{message}</div>}
    {error && <div className="field-error" role="alert">{error}</div>}
    <Card title="Activation d’un groupe">
      {loading ? <p>Chargement des paramètres…</p> : quota ? <>
        <div className="group-chat-rule-setting">
          <div className="group-chat-rule-copy">
            <strong>{quota.label}</strong>
            <p>{quota.description}</p>
            <small>Valeur autorisée : {quota.min_value} à {quota.max_value} membres.</small>
          </div>
          <label className="group-chat-rule-input">
            <span>Nombre de membres</span>
            <input
              type="number"
              min={quota.min_value}
              max={quota.max_value}
              step={1}
              value={draftValue}
              onChange={(event) => { setDraftValue(event.target.value); setMessage(''); setError('') }}
              aria-label="Nombre minimal de membres actifs pour activer un groupe"
            />
          </label>
        </div>
        <div className="group-chat-rule-preview">
          <span className="group-chat-rule-icon" aria-hidden="true">◎</span>
          <div>
            <strong>Comportement actuel</strong>
            <p>Un groupe pourra envoyer des messages après l’acceptation des invitations par <b>{draftValue || '—'} membres actifs</b>, créateur inclus. Une fois activé, il restera utilisable même si le nombre de membres descend ensuite.</p>
          </div>
        </div>
        <p className="group-chat-rule-note">La règle est vérifiée par Supabase au moment où une invitation est acceptée. Le contrôle n’est pas uniquement visuel côté application.</p>
      </> : <p>Aucun paramètre disponible.</p>}
    </Card>
  </div>
}

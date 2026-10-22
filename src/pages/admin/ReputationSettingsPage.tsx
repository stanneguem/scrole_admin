import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Card } from '../../components/ui/Card'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import './ReputationSettingsPage.css'

type ReputationRule = {
  rule_key: string
  label: string
  points: number
  daily_cap: number | null
  enabled: boolean
  config: Record<string, unknown>
  sort_order: number
  updated_at: string
}

const dimensionLabels: Record<string, string> = {
  quality: 'Qualité des contributions',
  recognition: 'Reconnaissance reçue',
  consistency: 'Régularité',
  communities: 'Contribution aux communautés',
  trust: 'Fiabilité comportementale',
}

const numberConfig = (rule: ReputationRule, key: string, fallback: number) => {
  const value = rule.config[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function ReputationSettingsPage() {
  const { user } = useAuth()
  const [rules, setRules] = useState<ReputationRule[]>([])
  const [drafts, setDrafts] = useState<Record<string, ReputationRule>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [penaltyUserId, setPenaltyUserId] = useState('')
  const [penaltyScope, setPenaltyScope] = useState<'global' | 'community'>('global')
  const [penaltyCommunityId, setPenaltyCommunityId] = useState('')
  const [penaltySourceType, setPenaltySourceType] = useState('moderation_case')
  const [penaltySourceId, setPenaltySourceId] = useState('')
  const [penaltyReason, setPenaltyReason] = useState('')
  const [penaltyPoints, setPenaltyPoints] = useState(1)
  const [applyingPenalty, setApplyingPenalty] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('admin_get_reputation_rules')
    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }
    const rows = (data ?? []) as ReputationRule[]
    setRules(rows)
    setDrafts(Object.fromEntries(rows.map(rule => [rule.rule_key, { ...rule, config: { ...rule.config } }])))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const dimensions = useMemo(() => {
    const byDimension = new Map<string, number>()
    for (const rule of Object.values(drafts)) {
      const dimension = String(rule.config.dimension ?? '')
      const weight = numberConfig(rule, 'dimension_weight', 0)
      if (dimension && weight > 0) byDimension.set(dimension, Math.max(byDimension.get(dimension) ?? 0, weight))
    }
    return [...byDimension.entries()].sort((a, b) => b[1] - a[1])
  }, [drafts])

  const patchRule = (key: string, patch: Partial<ReputationRule>) => {
    setDrafts(current => ({ ...current, [key]: { ...current[key], ...patch } }))
  }

  const patchConfig = (key: string, configKey: string, value: number) => {
    setDrafts(current => {
      const target = current[key]
      if (!target) return current
      const targetDimension = String(target.config.dimension ?? '')
      const next = { ...current }
      for (const [ruleKey, rule] of Object.entries(current)) {
        const sameDimension = targetDimension !== '' && String(rule.config.dimension ?? '') === targetDimension
        if (ruleKey === key || (configKey === 'dimension_weight' && sameDimension)) {
          next[ruleKey] = { ...rule, config: { ...rule.config, [configKey]: value } }
        }
      }
      return next
    })
  }

  const save = async (rule: ReputationRule) => {
    setError('')
    setMessage('')
    if (!Number.isInteger(rule.points) || rule.points < -20 || rule.points > 20) {
      setError('Les points internes doivent être compris entre -20 et 20.')
      return
    }
    if (rule.daily_cap !== null && (!Number.isInteger(rule.daily_cap) || rule.daily_cap < 0)) {
      setError('Le plafond quotidien doit être un entier positif ou nul.')
      return
    }
    const weight = numberConfig(rule, 'dimension_weight', 0)
    const saturation = numberConfig(rule, 'saturation_k', 1)
    if (weight < 0 || weight > 1 || saturation <= 0) {
      setError('La pondération doit être comprise entre 0 et 1 et la saturation doit être positive.')
      return
    }
    setSaving(rule.rule_key)
    const { error: rpcError } = await supabase.rpc('admin_update_reputation_rule', {
      p_rule_key: rule.rule_key,
      p_points: rule.points,
      p_daily_cap: rule.daily_cap,
      p_enabled: rule.enabled,
      p_config: rule.config,
    })
    if (rpcError) {
      setError(rpcError.message)
      setSaving(null)
      return
    }
    setMessage(`Règle « ${rule.label} » enregistrée.`)
    await load()
    setSaving(null)
  }

  const applyPenalty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!penaltyUserId.trim() || !penaltySourceId.trim() || penaltyReason.trim().length < 8) {
      setError('Identifiant utilisateur, référence de modération et motif détaillé obligatoires.')
      return
    }
    if (penaltyScope === 'community' && !penaltyCommunityId.trim()) {
      setError('Saisissez l’identifiant de la communauté pour une pénalité locale.')
      return
    }
    setApplyingPenalty(true)
    const { error: rpcError } = await supabase.rpc('admin_apply_reputation_penalty', {
      p_user_id: penaltyUserId.trim(),
      p_scope_type: penaltyScope,
      p_scope_id: penaltyScope === 'community' ? penaltyCommunityId.trim() : null,
      p_source_type: penaltySourceType.trim(),
      p_source_id: penaltySourceId.trim(),
      p_reason: penaltyReason.trim(),
      p_points: penaltyPoints,
    })
    if (rpcError) setError(rpcError.message)
    else {
      setMessage('Pénalité enregistrée dans le journal de réputation.')
      setPenaltyUserId('')
      setPenaltyCommunityId('')
      setPenaltySourceId('')
      setPenaltyReason('')
    }
    setApplyingPenalty(false)
  }

  if (user?.role !== 'Super Admin' && !user?.permissions.includes('settings.edit')) {
    return <Card><div className="table-empty"><strong>Accès réservé</strong><p>La gestion de la réputation exige la permission « settings.edit ».</p></div></Card>
  }

  return <div className="reputation-settings-page">
    <header className="admin-page-header">
      <div><h1>Réputation Scrole</h1><p>Configurez les règles de calcul. La réputation publique reste toujours comprise entre 0,00 et 5,00.</p></div>
      <div className="admin-page-actions"><ScroleButton variant="secondary" onClick={() => void load()} disabled={loading || saving !== null}>Actualiser</ScroleButton></div>
    </header>
    <Card title="Pondérations de la note sur 5">
      <div className="reputation-dimensions">
        {dimensions.map(([dimension, weight]) => <div className="reputation-dimension" key={dimension}>
          <div><strong>{dimensionLabels[dimension] ?? dimension}</strong><span>{Math.round(weight * 100)} %</span></div>
          <div className="reputation-weight-track"><span style={{ width: `${Math.min(100, Math.max(0, weight * 100))}%` }} /></div>
        </div>)}
      </div>
      <p className="reputation-help">Les dimensions sont normalisées séparément, puis pondérées. Les unités internes du journal ne sont jamais affichées comme score public.</p>
    </Card>
    {message && <div className="toast-message" role="status">{message}</div>}
    {error && <div className="error-message" role="alert">{error}</div>}
    <Card title="Pénalité de modération confirmée">
      <p className="reputation-help">À utiliser uniquement après décision de modération. Chaque pénalité est liée à une référence et à un motif auditable ; elle ne peut pas être appliquée depuis l’application mobile.</p>
      <form className="reputation-penalty-form" onSubmit={event => void applyPenalty(event)}>
        <label>UUID de l’utilisateur<input value={penaltyUserId} onChange={event => setPenaltyUserId(event.target.value)} required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label>
        <label>Portée<select value={penaltyScope} onChange={event => setPenaltyScope(event.target.value as 'global' | 'community')}><option value="global">Réputation globale</option><option value="community">Communauté uniquement</option></select></label>
        {penaltyScope === 'community' && <label>UUID de la communauté<input value={penaltyCommunityId} onChange={event => setPenaltyCommunityId(event.target.value)} required /></label>}
        <label>Type de dossier<input value={penaltySourceType} onChange={event => setPenaltySourceType(event.target.value)} required /></label>
        <label>Référence du dossier<input value={penaltySourceId} onChange={event => setPenaltySourceId(event.target.value)} required /></label>
        <label>Points de pénalité<select value={penaltyPoints} onChange={event => setPenaltyPoints(Number(event.target.value))}><option value={1}>−1</option><option value={2}>−2</option><option value={3}>−3</option><option value={4}>−4</option><option value={5}>−5</option></select></label>
        <label className="reputation-penalty-reason">Motif détaillé<textarea value={penaltyReason} onChange={event => setPenaltyReason(event.target.value)} minLength={8} maxLength={1000} required rows={3} /></label>
        <div className="reputation-rule-actions"><span>La note publique est recalculée lors de la prochaine consultation.</span><ScroleButton type="submit" disabled={applyingPenalty}>{applyingPenalty ? 'Enregistrement…' : 'Enregistrer la pénalité'}</ScroleButton></div>
      </form>
    </Card>
    {loading ? <Card><p>Chargement des règles…</p></Card> : rules.map(original => {
      const rule = drafts[original.rule_key] ?? original
      const dirty = JSON.stringify(rule) !== JSON.stringify(original)
      const dimension = String(rule.config.dimension ?? '')
      return <Card className="reputation-rule-card" key={rule.rule_key}>
        <div className="reputation-rule-heading">
          <div><h2>{rule.label}</h2><p><code>{rule.rule_key}</code>{dimension ? ` · ${dimensionLabels[dimension] ?? dimension}` : ''}</p></div>
          <label className="reputation-enabled"><input type="checkbox" checked={rule.enabled} onChange={event => patchRule(rule.rule_key, { enabled: event.target.checked })} /> Activée</label>
        </div>
        <div className="reputation-rule-fields">
          <label>Unités internes<input type="number" min={-20} max={20} step={1} value={rule.points} onChange={event => patchRule(rule.rule_key, { points: Number(event.target.value) })} /></label>
          <label>Plafond quotidien<input type="number" min={0} step={1} placeholder="Sans plafond" value={rule.daily_cap ?? ''} onChange={event => patchRule(rule.rule_key, { daily_cap: event.target.value === '' ? null : Number(event.target.value) })} /></label>
          {dimension && <label>Pondération (0–1)<input type="number" min={0} max={1} step={0.01} value={numberConfig(rule, 'dimension_weight', 0)} onChange={event => patchConfig(rule.rule_key, 'dimension_weight', Number(event.target.value))} /></label>}
          {rule.config.saturation_k !== undefined && <label>Saturation (k)<input type="number" min={1} step={1} value={numberConfig(rule, 'saturation_k', 30)} onChange={event => patchConfig(rule.rule_key, 'saturation_k', Number(event.target.value))} /></label>}
          {rule.config.grace_days !== undefined && <label>Délai de grâce (jours)<input type="number" min={0} max={365} step={1} value={numberConfig(rule, 'grace_days', 30)} onChange={event => patchConfig(rule.rule_key, 'grace_days', Number(event.target.value))} /></label>}
          {rule.config.rate_percent !== undefined && <label>Baisse hebdomadaire (%)<input type="number" min={0} max={20} step={0.1} value={numberConfig(rule, 'rate_percent', 1)} onChange={event => patchConfig(rule.rule_key, 'rate_percent', Number(event.target.value))} /></label>}
        </div>
        <div className="reputation-rule-actions"><span>{dirty ? 'Modifications non enregistrées' : `Mis à jour le ${new Date(original.updated_at).toLocaleDateString()}`}</span><ScroleButton onClick={() => void save(rule)} disabled={!dirty || saving !== null}>{saving === rule.rule_key ? 'Enregistrement…' : 'Enregistrer'}</ScroleButton></div>
      </Card>
    })}
  </div>
}

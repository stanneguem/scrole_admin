import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { supabase } from '../../lib/supabase'

type ConfigRow = {
  id?: number
  min_version: string | null
  current_version: string | null
  is_maintenance: boolean | null
  maintenance_message: string | null
  force_update_enabled: boolean | null
  update_message: string | null
  android_store_url: string | null
  ios_store_url: string | null
  updated_at?: string | null
}

const defaults: ConfigRow = {
  min_version: '1.0.0', current_version: '1.0.0', is_maintenance: false,
  maintenance_message: null, force_update_enabled: false, update_message: null,
  android_store_url: '', ios_store_url: '',
}

export function AppVersionPage() {
  const [config, setConfig] = useState<ConfigRow>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true); setError('')
      const { data, error: queryError } = await supabase.from('app_config')
        .select('id,min_version,current_version,is_maintenance,maintenance_message,force_update_enabled,update_message,android_store_url,ios_store_url,updated_at')
        .order('id', { ascending: false }).limit(1).maybeSingle()
      if (!alive) return
      if (queryError) setError(queryError.message)
      else if (data) setConfig({ ...defaults, ...data })
      setLoading(false)
    }
    void load()
    return () => { alive = false }
  }, [])

  const set = <K extends keyof ConfigRow>(key: K, value: ConfigRow[K]) => setConfig(current => ({ ...current, [key]: value }))
  const save = async () => {
    setError(''); setMessage('')
    if (!config.min_version?.trim() || !config.current_version?.trim()) {
      setError('La version minimale et la version actuelle sont obligatoires.')
      return
    }
    const versionPattern = /^\d+(\.\d+){0,3}$/
    if (!versionPattern.test(config.min_version.trim()) || !versionPattern.test(config.current_version.trim())) {
      setError('Utilisez un format de version numérique, par exemple 1.4.0.')
      return
    }
    for (const [label, url] of [['Google Play', config.android_store_url], ['App Store', config.ios_store_url]] as const) {
      if (url?.trim() && !/^https?:\/\//i.test(url.trim())) {
        setError(`Le lien ${label} doit commencer par https://.`)
        return
      }
    }
    setSaving(true)
    try {
      const payload = {
        min_version: config.min_version.trim(),
        current_version: config.current_version.trim(),
        force_update_enabled: Boolean(config.force_update_enabled),
        update_message: config.update_message?.trim() || null,
        android_store_url: config.android_store_url?.trim() || null,
        ios_store_url: config.ios_store_url?.trim() || null,
        is_maintenance: Boolean(config.is_maintenance),
        maintenance_message: config.maintenance_message?.trim() || null,
        updated_at: new Date().toISOString(),
      }
      const result = config.id
        ? await supabase.from('app_config').update(payload).eq('id', config.id).select('id').single()
        : await supabase.from('app_config').insert(payload).select('id').single()
      if (result.error) throw result.error
      setConfig(current => ({ ...current, id: result.data.id, ...payload }))
      setMessage('Configuration enregistrée. Les appareils appliqueront la règle au prochain contrôle.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer la configuration.')
    } finally { setSaving(false) }
  }

  const field = (label: string, value: string | null | undefined, onChange: (v: string) => void, placeholder = '') => (
    <label className="app-version-field">{label}<input className="setting-input" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>
  )

  return <>
    <header className="admin-page-header"><div><h1>Version de l’application</h1><p>Contrôlez les versions publiées et déclenchez l’écran de mise à jour dans Scrole.</p></div><ScroleButton onClick={() => void save()} disabled={saving || loading}>{saving ? 'Enregistrement…' : 'Enregistrer'}</ScroleButton></header>
    {message && <div className="toast-message" role="status">{message}</div>}
    {error && <div className="field-error" role="alert">{error}</div>}
    {loading ? <Card><div className="feedback-state">Chargement de la configuration…</div></Card> : <>
      <Card title="Politique de mise à jour"><div className="app-version-form">
        {field('Version actuelle publiée', config.current_version, v => set('current_version', v), '1.4.0')}
        {field('Version minimale autorisée', config.min_version, v => set('min_version', v), '1.3.0')}
        <label className="app-version-toggle"><span><strong>Forcer la mise à jour</strong><small>Les versions inférieures à la version minimale verront l’écran bloquant.</small></span><input type="checkbox" className="setting-toggle" checked={Boolean(config.force_update_enabled)} onChange={e => set('force_update_enabled', e.target.checked)} /></label>
        <label className="app-version-field">Message affiché dans l’application<textarea className="setting-input" rows={4} value={config.update_message ?? ''} onChange={e => set('update_message', e.target.value)} placeholder="Une nouvelle version de Scrole est disponible. Mets à jour pour continuer." /></label>
      </div></Card>
      <Card title="Liens des boutiques"><div className="app-version-form">
        {field('Google Play Store (Android)', config.android_store_url, v => set('android_store_url', v), 'https://play.google.com/store/apps/details?id=…')}
        {field('Apple App Store (iOS)', config.ios_store_url, v => set('ios_store_url', v), 'https://apps.apple.com/app/id…')}
      </div></Card>
      <Card title="Maintenance"><div className="app-version-form">
        <label className="app-version-toggle"><span><strong>Mode maintenance</strong><small>Utilise l’écran de maintenance existant de l’application.</small></span><input type="checkbox" className="setting-toggle" checked={Boolean(config.is_maintenance)} onChange={e => set('is_maintenance', e.target.checked)} /></label>
        {field('Message de maintenance', config.maintenance_message, v => set('maintenance_message', v), 'Maintenance en cours. Réessaie plus tard.')}
      </div></Card>
      <p className="app-version-footnote">La règle est appliquée au prochain démarrage ou contrôle de configuration. Désactive « Forcer la mise à jour » pour laisser passer les anciennes versions.</p>
    </>}
  </>
}

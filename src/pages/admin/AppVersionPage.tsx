import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { supabase } from '../../lib/supabase'
import './AppVersionPage.css'

type Config = {
  id?: number
  min_version: string
  current_version: string
  is_maintenance: boolean
  maintenance_message: string
  force_update_enabled: boolean
  update_message: string
  android_store_url: string
  ios_store_url: string
}
const initial: Config = { min_version: '1.0.0', current_version: '1.0.0', is_maintenance: false, maintenance_message: '', force_update_enabled: false, update_message: '', android_store_url: '', ios_store_url: '' }

export function AppVersionPage() {
  const [config, setConfig] = useState<Config>(initial)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error: e } = await supabase.from('app_config')
        .select('id,min_version,current_version,is_maintenance,maintenance_message,force_update_enabled,update_message,android_store_url,ios_store_url')
        .order('id', { ascending: false }).limit(1).maybeSingle()
      if (!active) return
      if (e) setError(e.message)
      else if (data) setConfig({ ...initial, ...data, maintenance_message: data.maintenance_message ?? '', update_message: data.update_message ?? '', android_store_url: data.android_store_url ?? '', ios_store_url: data.ios_store_url ?? '' })
      setLoading(false)
    })()
    return () => { active = false }
  }, [])
  const change = <K extends keyof Config>(key: K, value: Config[K]) => setConfig(old => ({ ...old, [key]: value }))
  const field = (label: string, key: keyof Config, placeholder = '') => <label className="app-version-field">{label}<input className="app-version-input" value={String(config[key] ?? '')} onChange={e => change(key, e.target.value as never)} placeholder={placeholder} /></label>
  const save = async () => {
    setError(''); setNotice('')
    if (!/^\d+(\.\d+){0,3}$/.test(config.min_version.trim()) || !/^\d+(\.\d+){0,3}$/.test(config.current_version.trim())) {
      setError('Utilise un numéro de version comme 1.4.0.'); return
    }
    for (const [label, url] of [['Google Play', config.android_store_url], ['App Store', config.ios_store_url]] as const) {
      if (url.trim() && !/^https?:\/\//i.test(url.trim())) { setError(`Le lien ${label} doit commencer par https://.`); return }
    }
    setSaving(true)
    const payload = { min_version: config.min_version.trim(), current_version: config.current_version.trim(), is_maintenance: config.is_maintenance, maintenance_message: config.maintenance_message.trim() || null, force_update_enabled: config.force_update_enabled, update_message: config.update_message.trim() || null, android_store_url: config.android_store_url.trim() || null, ios_store_url: config.ios_store_url.trim() || null, updated_at: new Date().toISOString() }
    try {
      const result = config.id
        ? await supabase.from('app_config').update(payload).eq('id', config.id).select('id').single()
        : await supabase.from('app_config').insert(payload).select('id').single()
      if (result.error) throw result.error
      setConfig(old => ({ ...old, ...payload, id: result.data.id, maintenance_message: payload.maintenance_message ?? '', update_message: payload.update_message ?? '', android_store_url: payload.android_store_url ?? '', ios_store_url: payload.ios_store_url ?? '' }))
      setNotice('Configuration enregistrée. Scrole appliquera la règle au prochain contrôle de version.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’enregistrer la configuration.') }
    finally { setSaving(false) }
  }
  return <>
    <header className="admin-page-header"><div><h1>Version de l’application</h1><p>Configure la version minimale, l’écran de mise à jour et les liens des boutiques.</p></div><ScroleButton onClick={() => void save()} disabled={saving || loading}>{saving ? 'Enregistrement…' : 'Enregistrer'}</ScroleButton></header>
    {error && <div className="field-error" role="alert">{error}</div>}{notice && <div className="toast-message" role="status">{notice}</div>}
    {loading ? <Card><div className="feedback-state">Chargement de la configuration…</div></Card> : <>
      <Card title="Politique de version"><div className="app-version-form">
        {field('Version publiée', 'current_version', '1.4.0')}
        {field('Version minimale autorisée', 'min_version', '1.3.0')}
        <label className="app-version-toggle"><span><strong>Forcer la mise à jour</strong><small>Les versions inférieures à la version minimale sont bloquées et dirigées vers la boutique.</small></span><input type="checkbox" checked={config.force_update_enabled} onChange={e => change('force_update_enabled', e.target.checked)} /></label>
        <label className="app-version-field app-version-full">Message affiché dans l’application<textarea className="app-version-input" rows={4} value={config.update_message} onChange={e => change('update_message', e.target.value)} placeholder="Une nouvelle version est disponible. Mets à jour Scrole pour continuer." /></label>
      </div></Card>
      <Card title="Liens des boutiques"><div className="app-version-form">
        {field('Google Play Store (Android)', 'android_store_url', 'https://play.google.com/store/apps/details?id=…')}
        {field('Apple App Store (iOS)', 'ios_store_url', 'https://apps.apple.com/app/id…')}
      </div></Card>
      <Card title="Maintenance"><div className="app-version-form">
        <label className="app-version-toggle"><span><strong>Mode maintenance</strong><small>Active l’écran de maintenance existant.</small></span><input type="checkbox" checked={config.is_maintenance} onChange={e => change('is_maintenance', e.target.checked)} /></label>
        <label className="app-version-field app-version-full">Message de maintenance<textarea className="app-version-input" rows={3} value={config.maintenance_message} onChange={e => change('maintenance_message', e.target.value)} placeholder="Maintenance en cours. Réessaie plus tard." /></label>
      </div></Card>
      <p className="app-version-footnote">Le contrôle de version est effectué au démarrage. Désactive l’option de mise à jour forcée pour laisser accéder les anciennes versions.</p>
    </>}
  </>
}

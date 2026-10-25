import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { supabase } from '../../lib/supabase'
import './NotificationsPage.css'

type Country = { id: string; name: string; code?: string }
type Mode = 'user' | 'segment'
export function NotificationsPage() {
  const [mode, setMode] = useState<Mode>('segment')
  const [userId, setUserId] = useState('')
  const [platform, setPlatform] = useState('all')
  const [gender, setGender] = useState('all')
  const [countryId, setCountryId] = useState('all')
  const [language, setLanguage] = useState('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [countries, setCountries] = useState<Country[]>([])
  const [loadingCountries, setLoadingCountries] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sentCount, setSentCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error: loadError } = await supabase.from('countries').select('*').order('name')
      if (!active) return
      if (!loadError && data) setCountries(data.map((row: any) => ({ id: String(row.id), name: String(row.name ?? row.nom ?? row.country_name ?? row.code ?? row.id), code: row.code ?? row.iso_code ?? undefined })))
      else if (loadError) setError('Impossible de charger les pays : ' + loadError.message)
      setLoadingCountries(false)
    })()
    return () => { active = false }
  }, [])

  const canSend = useMemo(() => title.trim().length > 0 && body.trim().length > 0 && (mode === 'segment' || /^[0-9a-f-]{36}$/i.test(userId.trim())), [title, body, mode, userId])
  const send = async () => {
    setError(''); setNotice(''); setSentCount(null)
    if (!canSend) { setError(mode === 'user' ? 'Saisis un identifiant UUID valide et le titre/message.' : 'Le titre et le message sont obligatoires.'); return }
    if (!window.confirm(mode === 'user' ? 'Envoyer cette notification à cet utilisateur ?' : 'Envoyer cette notification à tous les utilisateurs correspondant aux filtres ?')) return
    setSending(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-send-notification', {
        body: { mode, user_id: mode === 'user' ? userId.trim() : undefined, filters: { platform, gender, country_id: countryId, language }, title: title.trim(), body: body.trim() },
      })
      if (invokeError) throw invokeError
      if (data?.error) throw new Error(data.error)
      setSentCount(Number(data?.recipients ?? 0))
      setNotice(`Notification créée pour ${Number(data?.recipients ?? 0)} utilisateur(s). L’envoi push est traité par le système Scrole existant.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Échec de l’envoi. Réessaie.') }
    finally { setSending(false) }
  }

  return <div className="admin-notifications-page">
    <header className="admin-page-header"><div><h1>Notifications</h1><p>Envoie un message personnalisé ou cible une audience Scrole par appareil, genre, pays et langue.</p></div><ScroleButton onClick={() => void send()} disabled={sending || loadingCountries || !canSend}>{sending ? 'Envoi…' : 'Envoyer la notification'}</ScroleButton></header>
    {error && <div className="field-error" role="alert">{error}</div>}
    {notice && <div className="toast-message" role="status">{notice}{sentCount !== null ? ` · ${sentCount} destinataire(s)` : ''}</div>}
    <Card title="Destinataires"><div className="notif-mode-tabs" role="group" aria-label="Mode de ciblage">
      <button type="button" className={mode === 'segment' ? 'active' : ''} onClick={() => setMode('segment')}>Groupe ciblé</button>
      <button type="button" className={mode === 'user' ? 'active' : ''} onClick={() => setMode('user')}>Un utilisateur précis</button>
    </div>
    {mode === 'user' ? <label className="notif-field notif-full">Identifiant utilisateur (UUID)<input value={userId} onChange={e => setUserId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label> :
      <div className="notif-filter-grid">
        <label className="notif-field">Appareil / système<select value={platform} onChange={e => setPlatform(e.target.value)}><option value="all">Tous les appareils</option><option value="android">Android</option><option value="ios">iOS / iPhone</option><option value="web">Web</option></select></label>
        <label className="notif-field">Genre<select value={gender} onChange={e => setGender(e.target.value)}><option value="all">Tous</option><option value="female">Fille / femme</option><option value="male">Garçon / homme</option><option value="other">Autre / non précisé</option></select></label>
        <label className="notif-field">Pays<select value={countryId} onChange={e => setCountryId(e.target.value)}><option value="all">Tous les pays</option>{countries.map(c => <option key={c.id} value={c.id}>{c.name}{c.code ? ` · ${c.code}` : ''}</option>)}</select></label>
        <label className="notif-field">Langue préférée<select value={language} onChange={e => setLanguage(e.target.value)}><option value="all">Toutes les langues</option><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option><option value="de">Deutsch</option><option value="it">Italiano</option><option value="pt">Português</option><option value="zh">中文</option><option value="ja">日本語</option><option value="ru">Русский</option></select></label>
      </div>}
    <p className="notif-hint">Les filtres sont combinés : un utilisateur doit correspondre à tous les critères choisis. Les préférences de notifications de chaque compte restent prioritaires.</p>
    </Card>
    <Card title="Contenu de la notification"><div className="notif-compose">
      <label className="notif-field notif-full">Titre<input maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. Une nouveauté sur Scrole" /><small>{title.length}/120</small></label>
      <label className="notif-field notif-full">Message<textarea maxLength={1000} rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="Écris le message à afficher dans la notification…" /><small>{body.length}/1000</small></label>
      <div className="notif-preview"><span className="notif-preview-icon">S</span><div><strong>{title.trim() || 'Titre de la notification'}</strong><p>{body.trim() || 'Le message apparaîtra ici dans la notification.'}</p><small>Scrole · aperçu</small></div></div>
    </div></Card>
    <p className="notif-footnote">L’envoi est journalisé dans le centre de notifications de Scrole. Vérifie l’audience et le texte avant de confirmer : les notifications déjà envoyées ne peuvent pas être rappelées.</p>
  </div>
}

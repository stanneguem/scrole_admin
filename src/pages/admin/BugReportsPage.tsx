import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import './BugReportsPage.css'

type BugReport = {
  id: string
  user_id: string | null
  title: string
  description: string
  metadata: Record<string, unknown> | null
  status: string | null
  screenshot_object_key: string | null
  resolved_by: string | null
  created_at: string | null
  updated_at: string | null
}
type Filter = 'open' | 'in_progress' | 'resolved' | 'rejected' | 'all'
const statusLabels: Record<string, string> = { open: 'À traiter', in_progress: 'En cours', resolved: 'Résolu', rejected: 'Rejeté' }
const statusLabel = (status: string | null) => statusLabels[status ?? 'open'] ?? status ?? 'À traiter'
const statusTone = (status: string | null): 'success' | 'danger' | 'warning' => status === 'resolved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

export function BugReportsPage() {
  const { hasPermission } = useAuth()
  const [items, setItems] = useState<BugReport[]>([])
  const [filter, setFilter] = useState<Filter>('open')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let query = supabase.from('bug_reports').select('id,user_id,title,description,metadata,status,screenshot_object_key,resolved_by,created_at,updated_at').order('created_at', { ascending: false }).limit(200)
      if (filter !== 'all') query = query.eq('status', filter)
      const { data, error: queryError } = await query
      if (queryError) throw queryError
      const rows = (data ?? []) as BugReport[]
      setItems(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les signalements de bugs. Vérifiez les permissions administrateur.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  const updateReport = async (report: BugReport, status: 'open' | 'in_progress' | 'resolved' | 'rejected') => {
    if (!hasPermission('reports.resolve') || busyId) return
    setBusyId(report.id); setError(''); setMessage('')
    try {
      const { error: updateError } = await supabase.from('bug_reports').update({
        status,
        resolved_by: status === 'resolved' || status === 'rejected' ? (await supabase.auth.getUser()).data.user?.id ?? null : null,
        updated_at: new Date().toISOString(),
      }).eq('id', report.id)
      if (updateError) throw updateError
      setMessage('Signalement mis à jour.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La mise à jour a échoué.')
    } finally {
      setBusyId(null)
    }
  }

  const openScreenshot = async (report: BugReport) => {
    if (!report.screenshot_object_key || openingId) return
    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      setError('Autorisez les fenêtres contextuelles pour consulter la capture.')
      return
    }
    previewWindow.document.title = 'Ouverture de la capture Scrole…'
    previewWindow.document.body.textContent = 'Préparation du lien privé sécurisé…'
    setOpeningId(report.id); setError('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('r2-media-upload', { body: { action: 'create-download-url', object_key: report.screenshot_object_key } })
      if (invokeError) throw invokeError
      if (typeof data?.url !== 'string' || !data.url.startsWith('https://')) throw new Error('R2 n’a pas retourné de lien de consultation valide.')
      previewWindow.location.href = data.url
    } catch (e) {
      previewWindow.close()
      setError(e instanceof Error ? e.message : 'Impossible d’ouvrir la capture privée R2.')
    } finally {
      setOpeningId(null)
    }
  }

  return <div className="bug-reports-page">
    <header className="admin-page-header">
      <div><h1>Signalements de bugs</h1><p>Rapports envoyés depuis l’application Scrole. Les captures restent privées dans Cloudflare R2 et sont ouvertes via un lien temporaire autorisé.</p></div>
      <div className="admin-page-actions"><ScroleButton variant="secondary" onClick={() => void load()}>Actualiser</ScroleButton></div>
    </header>
    {error && <div className="form-message form-message-error" role="alert">{error}</div>}
    {message && <div className="toast-message" role="status">{message}</div>}
    <Card className="resource-card">
      <div className="resource-toolbar">
        <label className="search-field"><span aria-hidden="true">▤</span><select value={filter} onChange={e => setFilter(e.target.value as Filter)} aria-label="Filtrer les signalements de bugs">
          <option value="open">À traiter</option><option value="in_progress">En cours</option><option value="resolved">Résolus</option><option value="rejected">Rejetés</option><option value="all">Tous</option>
        </select></label>
        <span className="result-count">{items.length} rapport{items.length > 1 ? 's' : ''}</span>
      </div>
      {loading ? <div className="table-empty">Chargement des rapports…</div> : items.length === 0 ? <div className="table-empty">Aucun rapport pour ce filtre.</div> :
        <div className="bug-report-list">{items.map(report => <article className="bug-report-item" key={report.id}>
          <div className="bug-report-heading"><div><h2>{report.title}</h2><small>{report.id} · {dateLabel(report.created_at)} · utilisateur {report.user_id ?? 'non identifié'}</small></div><StatusBadge tone={statusTone(report.status)}>{statusLabel(report.status)}</StatusBadge></div>
          <p className="bug-report-description">{report.description}</p>
          {report.metadata && <details><summary>Informations techniques</summary><pre>{JSON.stringify(report.metadata, null, 2)}</pre></details>}
          {report.screenshot_object_key && <div className="bug-report-media"><ScroleButton variant="secondary" disabled={openingId === report.id} onClick={() => void openScreenshot(report)}>{openingId === report.id ? 'Préparation du lien…' : 'Ouvrir la capture R2'}</ScroleButton></div>}
          <div className="bug-report-actions">
            <ScroleButton variant="secondary" disabled={!hasPermission('reports.resolve') || busyId === report.id} onClick={() => void updateReport(report, 'in_progress')}>Prendre en charge</ScroleButton>
            <ScroleButton disabled={!hasPermission('reports.resolve') || busyId === report.id} onClick={() => void updateReport(report, 'resolved')}>Marquer résolu</ScroleButton>
            <ScroleButton variant="secondary" disabled={!hasPermission('reports.resolve') || busyId === report.id} onClick={() => void updateReport(report, 'rejected')}>Rejeter</ScroleButton>
          </div>
        </article>)}</div>}
    </Card>
  </div>
}

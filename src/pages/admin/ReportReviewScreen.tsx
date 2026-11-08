import { useMemo, useState } from 'react'
import type { Report } from './PlatformReportsPage'
import './ReportReviewScreen.css'

type Props = {
  report: Report
  decision: string
  onDecision: (value: 'dismiss' | 'remove_content' | 'shadowban' | 'suspend_user' | 'suspend_community') => void
  note: string
  onNote: (value: string) => void
  onBack: () => void
  onConfirm: () => void
  busy: boolean
  canDelete: boolean
  canShadowban: boolean
  canSuspendUser: boolean
  canSuspendCommunity: boolean
  onNavigate: (path: string) => void
}

type MediaItem = { url: string; thumbnail?: string; type: 'image' | 'video'; label: string }

const personName = (person?: { username?: string; first_name?: string; last_name?: string } | null) => {
  if (!person) return 'Compte indisponible'
  const name = [person.first_name, person.last_name].filter(Boolean).join(' ').trim()
  return name || (person.username ? '@' + person.username : 'Compte indisponible')
}

const reportTypeLabel: Record<string, string> = {
  post: 'Publication', comment: 'Commentaire', story: 'Story',
  user: 'Profil', profile: 'Profil', community: 'Communauté',
}

function collectMedia(target: NonNullable<Report['target']>): MediaItem[] {
  const candidates: MediaItem[] = []
  const add = (url: unknown, type: 'image' | 'video', thumbnail?: unknown) => {
    if (typeof url !== 'string' || !url.trim()) return
    candidates.push({ url: url.trim(), type, thumbnail: typeof thumbnail === 'string' ? thumbnail : undefined, label: type === 'video' ? 'Vidéo' : 'Image' })
  }

  if (Array.isArray(target.media)) {
    target.media.forEach(item => add(item.url, item.type === 'video' ? 'video' : 'image', item.thumbnail_url))
  }
  if (Array.isArray(target.photos)) target.photos.forEach(url => add(url, 'image'))
  add(target.photo, 'image')
  add(target.image_url, target.kind === 'video' ? 'video' : 'image', target.thumbnail_url)
  if (Array.isArray(target.videos)) {
    target.videos.forEach(item => add(typeof item === 'string' ? item : item.url, 'video', typeof item === 'string' ? undefined : item.thumbnail_url))
  }
  add(target.video_url, 'video', target.video_thumbnail_url)

  const seen = new Set<string>()
  return candidates.filter(item => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

const formatDate = (value?: string) => value
  ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
  : 'Date indisponible'

export function ReportReviewScreen(props: Props) {
  const { report, onBack, onNavigate } = props
  const [showAuthor, setShowAuthor] = useState(true)
  const [zoomed, setZoomed] = useState<string | null>(null)
  const target = report.target
  const media = useMemo(() => target ? collectMedia(target) : [], [target])
  const author = target?.author ?? target?.creator ?? target
  const authorId = author && 'user_id' in author ? author.user_id : undefined
  const isContent = ['post', 'comment', 'story'].includes(report.target_type)

  return <main className="report-review-page">
    <header className="report-review-topbar">
      <button type="button" className="report-back-button" onClick={onBack}>← <span>Retour aux signalements</span></button>
      <div className="report-review-top-actions">
        <span className={'report-review-status ' + (report.status === 'en_attente' || report.status === 'en_cours' ? 'is-open' : 'is-closed')}>{report.status === 'en_attente' ? 'À traiter' : report.status === 'en_cours' ? 'En cours' : 'Traité'}</span>
        <span className="report-review-reference">Réf. {report.id.slice(0, 8)}</span>
      </div>
    </header>

    <div className="report-review-heading">
      <div><span className="report-review-eyebrow">CENTRE DE MODÉRATION · {reportTypeLabel[report.target_type] ?? report.target_type}</span>
        <h1>Examen du signalement</h1>
        <p>Consultez le contenu et son contexte avant de prendre une décision.</p>
      </div>
      <div className="report-review-count"><strong>{report.reports_count ?? 1}</strong><span>signalement{(report.reports_count ?? 1) > 1 ? 's' : ''} sur cette cible</span></div>
    </div>

    <div className="report-review-layout">
      <section className="report-review-main-column">
        <article className="report-review-card report-content-card">
          <div className="report-card-heading"><div><span className="report-card-kicker">CONTENU SIGNALÉ</span><h2>{reportTypeLabel[report.target_type] ?? report.target_type}</h2></div><span className="report-card-date">{formatDate(target?.created_at)}</span></div>
          {target?.content && <p className="report-content-text">{target.content}</p>}
          {target?.name && <h3 className="report-target-name">{target.name}</h3>}
          {target?.description && <p className="report-content-text">{target.description}</p>}
          {target?.bio && <p className="report-content-text">{target.bio}</p>}
          {media.length > 0 && <div className={'report-media-grid media-count-' + Math.min(media.length, 4)}>
            {media.map((item, index) => <button type="button" className="report-media-item" key={item.url} onClick={() => setZoomed(item.url)} aria-label={'Agrandir ' + item.label.toLowerCase() + ' ' + (index + 1)}>
              {item.type === 'video'
                ? <><video src={item.url} poster={item.thumbnail} controls preload="metadata" onClick={event => event.stopPropagation()} /><span className="report-media-video-tag">VIDÉO</span></>
                : <img src={item.url} alt={'Média ' + (index + 1)} loading="lazy" />}
              {media.length > 1 && <span className="report-media-index">{index + 1}/{media.length}</span>}
            </button>)}
          </div>}
          {target?.shared_post_snapshot && <details className="report-shared-snapshot"><summary>Afficher la publication partagée</summary><pre>{JSON.stringify(target.shared_post_snapshot, null, 2)}</pre></details>}
          {!target && <div className="report-content-unavailable">Le contenu n’est plus disponible. Identifiant : {report.target_id}</div>}
          {report.description && <div className="report-reporter-note"><strong>Précisions du signalant</strong><p>{report.description}</p></div>}
        </article>

        <article className="report-review-card">
          <button type="button" className="report-author-toggle" onClick={() => setShowAuthor(value => !value)}>
            <span><span className="report-card-kicker">AUTEUR DU CONTENU</span><strong>{showAuthor ? 'Masquer les informations' : 'Afficher les informations'}</strong></span>
            <span aria-hidden="true">{showAuthor ? '⌃' : '⌄'}</span>
          </button>
          {showAuthor && <div className="report-author-profile">
            {(author as { photo_url?: string } | null)?.photo_url
              ? <img src={(author as { photo_url: string }).photo_url} alt="" />
              : <span className="report-author-avatar">{personName(author).slice(0, 1).toUpperCase()}</span>}
            <div><strong>{personName(author)}</strong><span>{(author as { username?: string } | null)?.username ? '@' + (author as { username: string }).username : 'Auteur du contenu'}</span></div>
            {authorId && <button type="button" className="report-inline-link" onClick={() => onNavigate('/admin/users/' + authorId)}>Voir le profil ↗</button>}
          </div>}
        </article>
      </section>

      <aside className="report-review-side-column">
        <article className="report-review-card report-reason-card">
          <span className="report-card-kicker">MOTIF DU SIGNALEMENT</span>
          <h2>{report.reason?.nom ?? 'Motif non précisé'}</h2>
          <p>{report.reason?.code ?? 'Signalement utilisateur'}</p>
          <div className="report-meta-divider" />
          <dl><div><dt>Reçu le</dt><dd>{formatDate(report.created_at)}</dd></div>
            <div><dt>Origine</dt><dd>{report.community?.name ?? (report.community_id ? 'Communauté' : 'Plateforme')}</dd></div>
            <div><dt>Signalements actifs</dt><dd>{report.reports_count ?? 1}</dd></div></dl>
        </article>

        <article className="report-review-card report-decision-card">
          <span className="report-card-kicker">DÉCISION DE MODÉRATION</span>
          <h2>Quelle action entreprendre ?</h2>
          <label className="report-field-label">Action
            <select value={props.decision} onChange={event => props.onDecision(event.target.value as Props['decision'] extends (value: infer T) => void ? T : never)}>
              <option value="dismiss">Rejeter le signalement</option>
              {isContent && props.canDelete && <option value="remove_content">Supprimer le contenu</option>}
              {report.target_type === 'post' && props.canShadowban && <option value="shadowban">Shadowban la publication</option>}
              {['user', 'profile'].includes(report.target_type) && props.canSuspendUser && <option value="suspend_user">Suspendre le profil</option>}
              {report.target_type === 'community' && props.canSuspendCommunity && <option value="suspend_community">Suspendre la communauté</option>}
            </select>
          </label>
          <label className="report-field-label">Note interne <span>(facultatif)</span>
            <textarea rows={4} maxLength={1000} value={props.note} onChange={event => props.onNote(event.target.value)} placeholder="Ajouter un contexte à la décision…" />
          </label>
          <button type="button" className="report-confirm-button" disabled={props.busy} onClick={props.onConfirm}>{props.busy ? 'Enregistrement…' : 'Confirmer la décision'}</button>
          <p className="report-decision-hint">La décision sera enregistrée dans le journal de modération.</p>
        </article>
      </aside>
    </div>
    {zoomed && <div className="report-lightbox" role="dialog" aria-modal="true" aria-label="Aperçu du média" onClick={() => setZoomed(null)}><button type="button" aria-label="Fermer" onClick={() => setZoomed(null)}>×</button><img src={zoomed} alt="Média agrandi" /></div>}
  </main>
}

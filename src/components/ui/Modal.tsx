import type { ReactNode } from 'react'
import { useEffect } from 'react'

type ModalProps = { title: string; children: ReactNode; onClose: () => void; confirmLabel?: string; onConfirm?: () => void; danger?: boolean }

export function Modal({ title, children, onClose, confirmLabel, onConfirm, danger = false }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header"><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer">×</button></header><div className="modal-body">{children}</div><footer className="modal-footer"><button type="button" className="scrole-button scrole-button-secondary" onClick={onClose}>Annuler</button>{onConfirm && <button type="button" className={`scrole-button ${danger ? 'scrole-button-danger' : 'scrole-button-primary'}`} onClick={onConfirm}>{confirmLabel ?? 'Confirmer'}</button>}</footer></section></div>
}
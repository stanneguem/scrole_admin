import { StatusBadge } from './StatusBadge'

type Props = { code?: string | null; compact?: boolean }

export function CertificationCodeBadge({ code, compact = false }: Props) {
  if (!code) return null
  return <span className={compact ? 'certification-code-inline certification-code-compact' : 'certification-code-inline'} title={`Code de certification : ${code}`}>
    <StatusBadge tone="info">Certifié</StatusBadge>
    <code>{code}</code>
  </span>
}

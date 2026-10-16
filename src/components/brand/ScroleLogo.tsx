import logoSource from '../../assets/scole-logo.png'

type ScroleLogoProps = {
  className?: string
  showName?: boolean
  label?: string
}

export function ScroleLogo({ className = '', showName = true, label = 'Scrole' }: ScroleLogoProps) {
  return <span className={`scrole-logo ${className}`.trim()}><img src={logoSource} alt={label} /><span className="scrole-logo-name">{showName ? 'SCROLE' : ''}</span></span>
}

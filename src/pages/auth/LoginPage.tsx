import { useState } from 'react'
import { AuthButton, AuthInput, FormError, PasswordInput } from '../../components/auth/AuthForm'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { preventDefaultSubmit } from '../../components/auth/authUtils'
import { useAuth } from '../../hooks/useAuth'

type LoginErrors = { email?: string; password?: string }

const INVALID_CREDENTIALS_MESSAGE =
  'Identifiants de connexion incorrects. Si vous n’êtes pas administrateur, veuillez utiliser la version utilisateur de Scrole. Pour toute assistance concernant l’accès administrateur, veuillez contacter un administrateur.'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState<LoginErrors>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const nextErrors: LoginErrors = {}
    if (!email.trim()) nextErrors.email = 'L’adresse e-mail est obligatoire.'
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = 'Saisissez une adresse e-mail valide.'
    if (!password) nextErrors.password = 'Le mot de passe est obligatoire.'

    setErrors(nextErrors)
    setFormError('')
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    try {
      await login(email, password, rememberMe)
      window.history.pushState({}, '', '/admin')
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connexion impossible.'
      setFormError(message.includes('Invalid login credentials') ? INVALID_CREDENTIALS_MESSAGE : message)
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Connexion à l’administration"
      description="Accédez à votre espace de gestion Scrole avec vos identifiants administrateur."
    >
      <form className="auth-form" onSubmit={preventDefaultSubmit(submit)} noValidate>
        {formError && <FormError>{formError}</FormError>}
        <AuthInput
          label="Adresse e-mail"
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          autoComplete="email"
          placeholder="vous@entreprise.com"
        />
        <PasswordInput
          label="Mot de passe"
          id="login-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          autoComplete="current-password"
          placeholder="Votre mot de passe"
        />
        <div className="form-options">
          <label className="checkbox-label">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            <span>Se souvenir de moi</span>
          </label>
        </div>
        <AuthButton loading={loading}>Se connecter</AuthButton>
      </form>
    </AuthLayout>
  )
}

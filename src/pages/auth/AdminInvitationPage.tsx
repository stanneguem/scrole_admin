import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AuthButton, FormError, PasswordInput } from '../../components/auth/AuthForm'
import { AuthLayout } from '../../components/auth/AuthLayout'

export function AdminInvitationPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadInvitation = async () => {
      const { data, error: authError } = await supabase.auth.getUser()

      if (authError || !data.user) {
        setError('Ce lien d’invitation est invalide ou a expiré.')
        setLoading(false)
        return
      }

      const { data: admin, error: profileError } = await supabase
        .from('administrateur_profil')
        .select('auth_id, actif, role')
        .eq('auth_id', data.user.id)
        .maybeSingle()

      if (profileError || !admin) {
        setError('Cette invitation administrateur est introuvable.')
      } else if (admin.actif) {
        setError('Cette invitation a déjà été activée. Vous pouvez vous connecter.')
      }

      setEmail(data.user.email ?? '')
      setLoading(false)
    }

    void loadInvitation()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSaving(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error('Session d’invitation invalide ou expirée.')

      const { data: activation, error: activationError } = await supabase.functions.invoke(
        'activate-administrator-invitation',
        { body: {} },
      )

      if (activationError) {
        throw new Error('Cette invitation est invalide, expirée ou déjà utilisée.')
      }
      if (!activation?.success) {
        throw new Error(activation?.message || 'Cette invitation est invalide, expirée ou déjà utilisée.')
      }

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      // L'activation est terminée. On déconnecte la session de récupération
      // puis on utilise React Router pour revenir à la page de connexion.
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Impossible de finaliser l’invitation.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <AuthLayout
      title="Activez votre accès administrateur"
      description="Définissez votre mot de passe pour terminer votre invitation Scrole Admin."
    >
      {error && <FormError>{error}</FormError>}
      {!error && (
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="profile-account-email">
            <span>Compte invité</span>
            <strong>{email}</strong>
          </div>
          <PasswordInput
            label="Mot de passe"
            id="invitation-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Au moins 8 caractères"
          />
          <PasswordInput
            label="Confirmer le mot de passe"
            id="invitation-password-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            placeholder="Retapez le mot de passe"
          />
          <AuthButton loading={saving}>Activer mon accès</AuthButton>
        </form>
      )}
    </AuthLayout>
  )
}

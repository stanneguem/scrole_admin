import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { ScroleLogo } from '../../components/brand/ScroleLogo'

export function AdminProfileSetupPage() {
  const { user, refreshProfile } = useAuth()
  const [firstName, setFirstName] = useState(user?.profile.firstName ?? '')
  const [lastName, setLastName] = useState(user?.profile.lastName ?? '')
  const [phone, setPhone] = useState(user?.profile.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!user) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError('Le prénom, le nom et le numéro de téléphone sont obligatoires.')
      return
    }

    setSaving(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        throw new Error('Session administrateur invalide ou expirée.')
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from('administrateur_profil')
        .update({
          prenom: firstName.trim(),
          nom: lastName.trim(),
          telephone: phone.trim(),
        })
        .eq('auth_id', authData.user.id)
        .select('id, prenom, nom, telephone')
        .maybeSingle()

      if (updateError) throw updateError
      if (!updatedProfile) {
        throw new Error('Impossible de trouver votre profil administrateur.')
      }

      await refreshProfile()
      window.history.replaceState({}, '', '/admin')
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Impossible d’enregistrer le profil.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="profile-setup-page">
      <div className="profile-setup-card">
        <div className="profile-setup-brand"><ScroleLogo /></div>
        <div className="profile-setup-header">
          <span className="profile-setup-eyebrow">Première connexion</span>
          <h1>Finalisez votre profil</h1>
          <p>Il ne reste que quelques informations pour accéder à Scrole Admin.</p>
        </div>

        <form onSubmit={handleSubmit} className="profile-setup-form">
          <div className="profile-form-grid">
            <label>
              Prénom
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Votre prénom"
                autoComplete="given-name"
                required
              />
            </label>
            <label>
              Nom
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Votre nom"
                autoComplete="family-name"
                required
              />
            </label>
            <label className="profile-form-full">
              Téléphone
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Ex. +237 6 XX XX XX XX"
                autoComplete="tel"
                required
              />
            </label>
          </div>

          <div className="profile-account-email"><span>Compte</span><strong>{user.email}</strong></div>
          <div className="profile-account-email"><span>Fonction</span><strong>{user.profile.functionTitle || user.role}</strong></div>
          {error && <div className="profile-setup-error" role="alert">{error}</div>}
          <button className="profile-setup-submit" type="submit" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer et accéder au dashboard'}
          </button>
        </form>
      </div>
    </main>
  )
}
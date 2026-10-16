import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import './CertificationPricingPage.css'

type CertificationType = { id: string; code: string; nom: string; description: string | null; est_actif?: boolean }
type PriceGroup = { id: string; nom: string; prix: number | string; devise: string; est_actif: boolean; certification_type_id: string; certification_type: CertificationType | CertificationType[] | null }
type Country = { id: string; nom: string; code_iso: string; is_active?: boolean }
type GroupCountry = { id: string; prix_groupe: string; pays_id: string; countries: Country | Country[] | null }
type GroupDraft = { id?: string; nom: string; certificationTypeId: string; prix: string; devise: string; estActif: boolean }
const one = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value

const COUNTRY_CURRENCY: Record<string, string[]> = {
  CM: ['XAF'], CG: ['XAF'], CD: ['CDF', 'USD'], GA: ['XAF'], GQ: ['XAF'], CF: ['XAF'], TD: ['XAF'],
  ZA: ['ZAR'], BF: ['XOF'], CI: ['XOF'], ET: ['ETB'], GN: ['GNF'], NE: ['XOF'], NG: ['NGN'], SN: ['XOF'],
  DE: ['EUR'], AR: ['ARS'], BE: ['EUR'], CA: ['CAD'], ES: ['EUR'], FR: ['EUR'], CH: ['CHF'],
}

export function CertificationPricingPage() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<PriceGroup[]>([])
  const [links, setLinks] = useState<GroupCountry[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [types, setTypes] = useState<CertificationType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<GroupDraft | null>(null)
  const [countryEditor, setCountryEditor] = useState<PriceGroup | null>(null)
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [countrySearch, setCountrySearch] = useState('')
  const [deleteGroup, setDeleteGroup] = useState<PriceGroup | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const [pricing, typeResult] = await Promise.all([
      supabase.functions.invoke('admin-certification-pricing', { body: { action: 'list' } }),
      supabase.functions.invoke('admin-certification-pricing', { body: { action: 'types' } }),
    ])
    if (pricing.error || !pricing.data?.success) { setError(pricing.error?.message ?? pricing.data?.message ?? 'Impossible de charger les groupes.'); setLoading(false); return }
    setGroups(pricing.data.groups ?? []); setLinks(pricing.data.countryLinks ?? []); setCountries(pricing.data.countries ?? [])
    if (!typeResult.error && typeResult.data?.success) setTypes(typeResult.data.types ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const selectedCountryData = useMemo(() => countries.filter(country => selectedCountries.includes(country.id)), [countries, selectedCountries])
  const availableCurrencies = useMemo(() => {
    const currencies = new Set<string>()
    for (const country of selectedCountryData) for (const currency of COUNTRY_CURRENCY[country.code_iso] ?? []) currencies.add(currency)
    return [...currencies]
  }, [selectedCountryData])

  useEffect(() => {
    if (!editor || availableCurrencies.length === 0) return
    if (!availableCurrencies.includes(editor.devise)) setEditor(current => current ? { ...current, devise: availableCurrencies[0] } : current)
  }, [availableCurrencies, editor])

  const openEditor = (group?: PriceGroup) => {
    setError(''); setCountrySearch('')
    if (group) {
      const assigned = links.filter(link => link.prix_groupe === group.id).map(link => link.pays_id)
      setSelectedCountries(assigned)
      setEditor({ id: group.id, nom: group.nom, certificationTypeId: group.certification_type_id, prix: String(group.prix), devise: group.devise, estActif: group.est_actif })
      return
    }
    setSelectedCountries([])
    setEditor({ nom: '', certificationTypeId: types[0]?.id ?? '', prix: '0', devise: '', estActif: true })
  }

  const saveGroup = async () => {
    if (!editor || !editor.nom.trim() || !editor.certificationTypeId || !editor.devise.trim()) { setError('Le nom, le type, le prix et la devise sont obligatoires.'); return }
    if (selectedCountries.length === 0) { setError('Sélectionnez au moins un pays avant de choisir la devise.'); return }
    const price = Number(editor.prix); if (!Number.isFinite(price) || price < 0) { setError('Le prix doit être un nombre positif ou nul.'); return }
    if (!availableCurrencies.includes(editor.devise)) { setError('La devise sélectionnée ne correspond pas aux pays du groupe.'); return }
    setSaving(true); setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('admin-certification-pricing', { body: { action: 'save_group', id: editor.id, nom: editor.nom.trim(), certificationTypeId: editor.certificationTypeId, prix: price, devise: editor.devise.trim().toUpperCase(), estActif: editor.estActif } })
    if (invokeError || !data?.success) { setError(invokeError?.message ?? data?.message ?? 'Impossible d’enregistrer le groupe.'); setSaving(false); return }
    const savedGroupId = data.id ?? editor.id
    if (!savedGroupId) { setError('Le groupe a été enregistré mais son identifiant est introuvable.'); setSaving(false); return }
    const countryResult = await supabase.functions.invoke('admin-certification-pricing', { body: { action: 'set_countries', groupId: savedGroupId, countryIds: selectedCountries } })
    if (countryResult.error || !countryResult.data?.success) { setError(countryResult.error?.message ?? countryResult.data?.message ?? 'Le groupe est enregistré, mais les pays n’ont pas pu être enregistrés.'); setSaving(false); return }
    setEditor(null); setMessage(editor.id ? 'Groupe mis à jour.' : 'Nouveau groupe créé.'); await load(); setSaving(false)
  }

  const openCountries = (group: PriceGroup) => { setCountryEditor(group); setCountrySearch(''); setSelectedCountries(links.filter(link => link.prix_groupe === group.id).map(link => link.pays_id)) }
  const saveCountries = async () => {
    if (!countryEditor) return; setSaving(true); setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('admin-certification-pricing', { body: { action: 'set_countries', groupId: countryEditor.id, countryIds: selectedCountries } })
    if (invokeError || !data?.success) { setError(invokeError?.message ?? data?.message ?? 'Impossible de modifier les pays.'); setSaving(false); return }
    setCountryEditor(null); setMessage(`Pays du groupe « ${countryEditor.nom} » mis à jour.`); await load(); setSaving(false)
  }
  const toggleGroup = async (group: PriceGroup) => { setSaving(true); setError(''); const { data, error: invokeError } = await supabase.functions.invoke('admin-certification-pricing', { body: { action: 'toggle_group', groupId: group.id, estActif: !group.est_actif } }); if (invokeError || !data?.success) setError(invokeError?.message ?? data?.message ?? 'Impossible de modifier le groupe.'); else { setMessage(group.est_actif ? 'Groupe désactivé.' : 'Groupe activé.'); await load() } setSaving(false) }
  const removeGroup = async () => { if (!deleteGroup) return; setSaving(true); setError(''); const { data, error: invokeError } = await supabase.functions.invoke('admin-certification-pricing', { body: { action: 'delete_group', groupId: deleteGroup.id } }); if (invokeError || !data?.success) setError(invokeError?.message ?? data?.message ?? 'Impossible de supprimer le groupe.'); else { setDeleteGroup(null); setMessage('Groupe supprimé.'); await load() } setSaving(false) }

  const visibleCountries = useMemo(() => countries.filter(country => `${country.nom} ${country.code_iso}`.toLowerCase().includes(countrySearch.toLowerCase())), [countries, countrySearch])
  const countryNames = (groupId: string) => links.filter(link => link.prix_groupe === groupId).map(link => one(link.countries)?.nom).filter(Boolean) as string[]
  const grouped = useMemo(() => { const map = new Map<string, PriceGroup[]>(); for (const group of groups) { const type = one(group.certification_type)?.nom ?? 'Sans type'; const current = map.get(type) ?? []; current.push(group); map.set(type, current) } return [...map.entries()] }, [groups])

  if (user?.role !== 'Super Admin') return <Card><div className="table-empty"><strong>Accès réservé</strong><p>La gestion des groupes de certification est réservée aux Super Admin.</p></div></Card>
  return <div className="certification-pricing-page">
    <header className="admin-page-header"><div><h1>Groupes et tarifs des certifications</h1><p>Créez vos propres groupes, affectez les pays et définissez librement les prix utilisés par Scrole.</p></div><div className="admin-page-actions"><ScroleButton variant="secondary" onClick={() => void load()} disabled={loading}>Actualiser</ScroleButton><ScroleButton onClick={() => openEditor()}>+ Nouveau groupe</ScroleButton></div></header>
    {message && <div className="toast-message" role="status">{message}</div>}{error && <div className="error-message" role="alert">{error}</div>}
    <Card title="Fonctionnement"><div className="pricing-rules"><span>✓ Le prix se définit d’abord, puis les pays déterminent les devises proposées.</span><span>✓ Les devises proposées dépendent des pays sélectionnés.</span><span>✓ Les pays, le prix et la devise sont enregistrés ensemble.</span><span>✓ Un groupe peut être désactivé sans supprimer son historique.</span></div></Card>
    {loading ? <Card><p>Chargement des groupes…</p></Card> : grouped.length === 0 ? <Card><div className="table-empty"><strong>Aucun groupe</strong><p>Créez votre premier groupe de tarification.</p></div></Card> : grouped.map(([typeName, items]) => <section className="pricing-group-section" key={typeName}><div className="pricing-section-title"><div><h2>{typeName}</h2><span>{items.length} groupe{items.length > 1 ? 's' : ''}</span></div></div><div className="pricing-group-grid">{items.map(group => { const names = countryNames(group.id); const shownCountries = names.slice(0, 4); const remainingCountries = Math.max(0, names.length - shownCountries.length); return <Card key={group.id} className="pricing-group-card"><div className="pricing-card-inner"><div className="pricing-group-head"><div className="pricing-group-title"><span className="pricing-group-kicker">Groupe de tarification</span><div className="pricing-group-name-row"><h3>{group.nom}</h3><StatusBadge tone={group.est_actif ? 'success' : 'neutral'}>{group.est_actif ? 'Actif' : 'Inactif'}</StatusBadge></div></div><div className="pricing-group-price"><strong>{group.prix}</strong><span>{group.devise}</span></div></div><div className="pricing-group-meta"><div><span>Pays attribués</span><strong>{names.length}</strong></div><div><span>Certification</span><strong>{one(group.certification_type)?.nom ?? '—'}</strong></div></div><div className="pricing-country-preview"><div className="pricing-country-preview-head"><span>Pays couverts</span>{names.length > 0 && <button type="button" onClick={() => openCountries(group)}>Voir tous</button>}</div>{names.length ? <div className="pricing-country-chips">{shownCountries.map(name => <span key={name}>{name}</span>)}{remainingCountries > 0 && <span className="pricing-country-more">+{remainingCountries}</span>}</div> : <p>Aucun pays attribué à ce groupe.</p>}</div><div className="pricing-group-actions"><ScroleButton variant="secondary" onClick={() => openCountries(group)}>Gérer les pays</ScroleButton><ScroleButton variant="secondary" onClick={() => openEditor(group)}>Modifier</ScroleButton><div className="pricing-more-actions"><button type="button" className="pricing-text-action" onClick={() => void toggleGroup(group)} disabled={saving}>{group.est_actif ? 'Désactiver' : 'Activer'}</button><button type="button" className="pricing-text-action pricing-danger" onClick={() => setDeleteGroup(group)} disabled={saving}>Supprimer</button></div></div></div></Card>})}</div></section>)}
    {editor && <Modal title={editor.id ? 'Modifier le groupe' : 'Créer un groupe'} onClose={() => !saving && setEditor(null)} confirmLabel={saving ? 'Enregistrement…' : 'Enregistrer'} onConfirm={() => void saveGroup()}><div className="group-editor"><label className="form-field"><span>Nom du groupe</span><input value={editor.nom} onChange={e => setEditor({ ...editor, nom: e.target.value })} placeholder="Ex. Afrique centrale" disabled={saving} /></label><label className="form-field"><span>Type de certification</span><select value={editor.certificationTypeId} onChange={e => setEditor({ ...editor, certificationTypeId: e.target.value })} disabled={saving}>{types.filter(t => t.est_actif !== false).map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></label><label className="form-field"><span>Prix</span><input type="number" min="0" step="0.01" value={editor.prix} onChange={e => setEditor({ ...editor, prix: e.target.value })} placeholder="Ex. 1000" disabled={saving} /></label><div className="editor-country-section"><div className="editor-section-heading"><div><strong>Pays du groupe</strong><span>{selectedCountries.length} sélectionné{selectedCountries.length > 1 ? 's' : ''}</span></div><small>Les pays déterminent les devises disponibles.</small></div><input className="country-search" value={countrySearch} onChange={e => setCountrySearch(e.target.value)} placeholder="Rechercher un pays…" disabled={saving} /><div className="country-check-list editor-country-list">{visibleCountries.map(country => <label key={country.id} className="country-check"><input type="checkbox" checked={selectedCountries.includes(country.id)} onChange={e => setSelectedCountries(current => e.target.checked ? [...current, country.id] : current.filter(id => id !== country.id))} disabled={saving} /><span>{country.nom}</span><small>{country.code_iso}</small></label>)}{visibleCountries.length === 0 && <p>Aucun pays trouvé.</p>}</div></div><label className="form-field"><span>Devise <small className="currency-hint">{availableCurrencies.length ? `${availableCurrencies.length} devise${availableCurrencies.length > 1 ? 's' : ''} disponible${availableCurrencies.length > 1 ? 's' : ''}` : 'Sélectionnez d’abord les pays'}</small></span><select value={editor.devise} onChange={e => setEditor({ ...editor, devise: e.target.value })} disabled={saving || availableCurrencies.length === 0}><option value="">Choisir une devise</option>{availableCurrencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></label><div className="currency-context">{selectedCountryData.length ? <><strong>Devises compatibles :</strong><span>{availableCurrencies.join(' · ')}</span></> : <span>Sélectionnez les pays pour afficher les devises compatibles.</span>}</div><label className="group-switch"><input type="checkbox" checked={editor.estActif} onChange={e => setEditor({ ...editor, estActif: e.target.checked })} disabled={saving} /><span>Groupe actif</span></label></div></Modal>}
    {countryEditor && <Modal title={`Pays — ${countryEditor.nom}`} onClose={() => !saving && setCountryEditor(null)} confirmLabel={saving ? 'Enregistrement…' : 'Enregistrer les pays'} onConfirm={() => void saveCountries()}><div className="country-manager"><p>Sélectionnez exactement les pays qui appartiennent à ce groupe. Les changements remplacent la sélection actuelle.</p><input className="country-search" value={countrySearch} onChange={e => setCountrySearch(e.target.value)} placeholder="Rechercher un pays…" disabled={saving} /><div className="country-selection-summary"><strong>{selectedCountries.length}</strong><span>pays sélectionnés</span></div><div className="country-check-list">{visibleCountries.map(country => <label key={country.id} className="country-check"><input type="checkbox" checked={selectedCountries.includes(country.id)} onChange={e => setSelectedCountries(current => e.target.checked ? [...current, country.id] : current.filter(id => id !== country.id))} disabled={saving} /><span>{country.nom}</span><small>{country.code_iso}</small></label>)}{visibleCountries.length === 0 && <p>Aucun pays trouvé.</p>}</div></div></Modal>}
    {deleteGroup && <Modal title="Supprimer le groupe" onClose={() => !saving && setDeleteGroup(null)} confirmLabel={saving ? 'Suppression…' : 'Supprimer'} danger onConfirm={() => void removeGroup()}><p>Voulez-vous vraiment supprimer le groupe <strong>{deleteGroup.nom}</strong> ?</p><p>Si le groupe est déjà utilisé par une demande de certification, la suppression sera refusée et vous pourrez simplement le désactiver.</p></Modal>}
  </div>
}

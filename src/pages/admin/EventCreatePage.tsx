import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { ScroleButton } from '../../components/ui/ScroleButton'
import { supabase } from '../../lib/supabase'

type ActivityDraft = { name: string; description: string; base_price: string; event_price: string; currency_code: string }
type TicketDraft = { name: string; price: string; currency_code: string }
type PlaceRow = { id: string; nom: string; country_id?: string | null; default_currency_code?: string | null }

const field = 'input'
const blankActivity = (): ActivityDraft => ({ name: '', description: '', base_price: '0', event_price: '0', currency_code: 'XAF' })
const blankTicket = (): TicketDraft => ({ name: '', price: '0', currency_code: 'XAF' })

export function EventCreatePage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const navigate = useNavigate()
  const [name,setName]=useState(''); const [slug,setSlug]=useState(''); const [description,setDescription]=useState('')
  const [startsAt,setStartsAt]=useState(''); const [endsAt,setEndsAt]=useState('')
  const [isVirtual,setIsVirtual]=useState(false); const [virtualLink,setVirtualLink]=useState('')
  const [countryId,setCountryId]=useState(''); const [cityId,setCityId]=useState(''); const [address,setAddress]=useState('')
  const [isFree,setIsFree]=useState(false); const [isPublic,setIsPublic]=useState(true); const [photo,setPhoto]=useState('')
  const [ownershipType,setOwnershipType]=useState<'platform'|'third_party'>('platform')
  const [ownershipNote,setOwnershipNote]=useState('')
  const [activities,setActivities]=useState<ActivityDraft[]>([])
  const [tickets,setTickets]=useState<TicketDraft[]>([])
  const [minAge,setMinAge]=useState(''); const [maxAge,setMaxAge]=useState('')
  const [servesAlcohol,setServesAlcohol]=useState(false); const [overnight,setOvernight]=useState(false)
  const [idRequired,setIdRequired]=useState(false); const [smokingAllowed,setSmokingAllowed]=useState(false)
  const [otherRestrictions,setOtherRestrictions]=useState(''); const [allowedGenders,setAllowedGenders]=useState<string[]>(['homme','femme'])
  const [openDays,setOpenDays]=useState<string[]>([])
  const [countries,setCountries]=useState<PlaceRow[]>([]); const [cities,setCities]=useState<PlaceRow[]>([])
  const [loadingPlaces,setLoadingPlaces]=useState(true); const [saving,setSaving]=useState(false)
  const [error,setError]=useState(''); const [success,setSuccess]=useState('')

  useEffect(()=>{ let alive=true; const load=async()=>{setLoadingPlaces(true); const [co,ci]=await Promise.all([supabase.from('countries').select('id,nom,default_currency_code').eq('is_active',true).order('nom'),supabase.from('cities').select('id,nom,country_id').eq('is_active',true).order('nom')]); if(!alive)return; if(!co.error)setCountries((co.data??[]) as PlaceRow[]); if(!ci.error)setCities((ci.data??[]) as PlaceRow[]); setLoadingPlaces(false)}; void load(); return()=>{alive=false} },[])
  const visibleCities=cities.filter(city=>city.country_id===countryId)
  const updateActivity=(index:number,key:keyof ActivityDraft,value:string)=>setActivities(rows=>rows.map((row,i)=>i===index?{...row,[key]:value}:row))
  const updateTicket=(index:number,key:keyof TicketDraft,value:string)=>setTickets(rows=>rows.map((row,i)=>i===index?{...row,[key]:value}:row))
  const addOpenDay=()=>{const value=window.prompt('Date d’ouverture (AAAA-MM-JJ)'); if(value && /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && !openDays.includes(value))setOpenDays(rows=>[...rows,value].sort())}

  const submit=async(event:React.FormEvent)=>{event.preventDefault();setError('');setSuccess('')
    if(!name.trim()||!startsAt){setError('Le nom et la date de début sont obligatoires.');return}
    if(endsAt&&new Date(endsAt)<=new Date(startsAt)){setError('La date de fin doit être postérieure à la date de début.');return}
    if(isVirtual&&!virtualLink.trim()){setError('Le lien est obligatoire pour un événement en ligne.');return}
    if(!isVirtual&&(!countryId||!cityId||!address.trim())){setError('Le pays, la ville et l’adresse sont obligatoires pour un événement physique.');return}
    if(ownershipType==='third_party'&&!ownershipNote.trim()){setError('Indique le nom du propriétaire tiers ou les informations disponibles pour sa revendication.');return}
    setSaving(true)
    try{
      const {data,error:invokeError}=await supabase.functions.invoke('admin-event-create',{body:{
        event:{name:name.trim(),slug:slug.trim()||undefined,description,photo:photo.trim()||null,starts_at:new Date(startsAt).toISOString(),ends_at:endsAt?new Date(endsAt).toISOString():null,is_virtual:isVirtual,virtual_link:isVirtual?virtualLink.trim():null,country_id:isVirtual?null:countryId,city_id:isVirtual?null:cityId,address:isVirtual?null:address.trim(),is_free:isFree,is_public:isPublic},
        activities:activities.filter(a=>a.name.trim()).map(a=>({...a,base_price:Number(a.base_price)||0,event_price:Number(a.event_price)||0})),
        tickets:tickets.filter(t=>t.name.trim()).map(t=>({...t,price:Number(t.price)||0})),
        restrictions:{min_age:minAge||null,max_age:maxAge||null,serves_alcohol:servesAlcohol,overnight_event:overnight,id_required:idRequired,smoking_allowed:smokingAllowed,other_restrictions:otherRestrictions,allowed_genders:allowedGenders},
        openDays,ownershipType,ownershipNote:ownershipNote.trim()||null
      }})
      if(invokeError)throw invokeError
      if(!data?.success||!data.eventId)throw new Error(data?.message||'La création de l’événement a échoué.')
      setSuccess('Événement créé et publié dans Scrole.')
      onNavigate('/admin/events/'+data.eventId)
    }catch(e){setError(e instanceof Error?e.message:'Impossible de créer cet événement.')}
    finally{setSaving(false)}
  }

  return <div className="event-create-page">
    <header className="admin-page-header"><div><button type="button" className="back-action" onClick={()=>onNavigate('/admin/events')}>← Retour aux événements</button><h1>Créer un événement</h1><p>Crée un événement complet depuis l’administration Scrole.</p></div></header>
    {error&&<div className="toast-message" role="alert">{error}</div>}{success&&<div className="toast-message" role="status">{success}</div>}
    <form onSubmit={submit} className="event-create-form">
      <Card title="Informations principales"><div className="role-editor-form">
        <label>Nom de l’événement<input className={field} value={name} onChange={e=>setName(e.target.value)} required maxLength={120}/></label>
        <label>Slug (facultatif)<input className={field} value={slug} onChange={e=>setSlug(e.target.value)} placeholder="Généré automatiquement si vide"/></label>
        <label>Description<textarea className="role-editor-textarea input" value={description} onChange={e=>setDescription(e.target.value)} rows={5}/></label>
        <label>URL de la photo de couverture<input className={field} value={photo} onChange={e=>setPhoto(e.target.value)} placeholder="https://…"/></label>
        <div className="event-create-two"><label>Date et heure de début<input className={field} type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} required/></label><label>Date et heure de fin<input className={field} type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></label></div>
        <div className="event-create-checks"><label><input type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)}/> Événement public</label><label><input type="checkbox" checked={isFree} onChange={e=>setIsFree(e.target.checked)}/> Événement gratuit</label></div>
      </div></Card>
      <Card title="Format et lieu"><div className="role-editor-form">
        <label className="role-editor-check"><input type="checkbox" checked={isVirtual} onChange={e=>setIsVirtual(e.target.checked)}/> Événement en ligne</label>
        {isVirtual?<label>Lien / canal<input className={field} value={virtualLink} onChange={e=>setVirtualLink(e.target.value)} required/></label>:<><div className="event-create-two"><label>Pays<select className={field} value={countryId} onChange={e=>{setCountryId(e.target.value);setCityId('')}} required><option value="">Sélectionner un pays</option>{countries.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select></label><label>Ville<select className={field} value={cityId} onChange={e=>setCityId(e.target.value)} required disabled={!countryId}><option value="">Sélectionner une ville</option>{visibleCities.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select></label></div><label>Adresse complète<input className={field} value={address} onChange={e=>setAddress(e.target.value)} required/></label></>}
        {loadingPlaces&&<small>Chargement des pays et villes…</small>}
      </div></Card>
      <Card title="Origine et propriété"><div className="role-editor-form">
        <label>À qui appartient cet événement ?<select className={field} value={ownershipType} onChange={e=>setOwnershipType(e.target.value as 'platform'|'third_party')}><option value="platform">À Scrole (événement de la plateforme)</option><option value="third_party">À un tiers (événement ajouté par Scrole)</option></select></label>
        {ownershipType==='third_party'&&<label>Informations sur le propriétaire / preuve attendue<textarea className="role-editor-textarea input" value={ownershipNote} onChange={e=>setOwnershipNote(e.target.value)} rows={3} placeholder="Nom de l’organisateur, structure, lien officiel, contact, référence de la preuve… " required/></label>}
        <small>{ownershipType==='platform'?'Scrole reste propriétaire de l’événement.':'Scrole conserve temporairement les droits techniques. Après vérification, un administrateur pourra transférer la propriété au véritable propriétaire.'}</small>
      </div></Card>
      <Card title="Activités proposées"><div className="event-create-list">{activities.map((a,i)=><div className="event-create-item" key={i}><div className="event-create-item-head"><strong>Activité {i+1}</strong><button type="button" className="table-action" onClick={()=>setActivities(rows=>rows.filter((_,j)=>j!==i))}>Retirer</button></div><div className="role-editor-form"><label>Nom<input className={field} value={a.name} onChange={e=>updateActivity(i,'name',e.target.value)}/></label><label>Description<textarea className="role-editor-textarea input" value={a.description} onChange={e=>updateActivity(i,'description',e.target.value)}/></label><div className="event-create-three"><label>Prix de base<input className={field} type="number" min="0" value={a.base_price} onChange={e=>updateActivity(i,'base_price',e.target.value)}/></label><label>Prix pour cet événement<input className={field} type="number" min="0" value={a.event_price} onChange={e=>updateActivity(i,'event_price',e.target.value)}/></label><label>Devise<input className={field} value={a.currency_code} onChange={e=>updateActivity(i,'currency_code',e.target.value.toUpperCase())}/></label></div></div></div>)}<button type="button" className="table-action" onClick={()=>setActivities(rows=>[...rows,blankActivity()])}>+ Ajouter une activité</button></div></Card>
      <Card title="Billets et tarifs"><div className="event-create-list">{tickets.map((t,i)=><div className="event-create-item" key={i}><div className="event-create-item-head"><strong>Billet {i+1}</strong><button type="button" className="table-action" onClick={()=>setTickets(rows=>rows.filter((_,j)=>j!==i))}>Retirer</button></div><div className="event-create-three"><label>Nom<input className={field} value={t.name} onChange={e=>updateTicket(i,'name',e.target.value)}/></label><label>Prix<input className={field} type="number" min="0" value={t.price} onChange={e=>updateTicket(i,'price',e.target.value)}/></label><label>Devise<input className={field} value={t.currency_code} onChange={e=>updateTicket(i,'currency_code',e.target.value.toUpperCase())}/></label></div></div>)}<button type="button" className="table-action" onClick={()=>setTickets(rows=>[...rows,blankTicket()])}>+ Ajouter un billet</button></div></Card>
      <Card title="Restrictions et conditions"><div className="role-editor-form">
        <div className="event-create-two"><label>Âge minimum<input className={field} type="number" min="0" value={minAge} onChange={e=>setMinAge(e.target.value)}/></label><label>Âge maximum<input className={field} type="number" min="0" value={maxAge} onChange={e=>setMaxAge(e.target.value)}/></label></div>
        <div className="event-create-checks"><label><input type="checkbox" checked={servesAlcohol} onChange={e=>setServesAlcohol(e.target.checked)}/> Alcool servi</label><label><input type="checkbox" checked={overnight} onChange={e=>setOvernight(e.target.checked)}/> Événement nocturne</label><label><input type="checkbox" checked={idRequired} onChange={e=>setIdRequired(e.target.checked)}/> Pièce d’identité requise</label><label><input type="checkbox" checked={smokingAllowed} onChange={e=>setSmokingAllowed(e.target.checked)}/> Fumer autorisé</label></div>
        <label>Public autorisé<select className={field} multiple value={allowedGenders} onChange={e=>setAllowedGenders(Array.from(e.target.selectedOptions).map(o=>o.value))}><option value="homme">Hommes</option><option value="femme">Femmes</option></select></label>
        <label>Autres restrictions<textarea className="role-editor-textarea input" value={otherRestrictions} onChange={e=>setOtherRestrictions(e.target.value)}/></label>
      </div></Card>
      <Card title="Jours d’ouverture (facultatif)"><div className="event-create-list"><div className="event-create-item-head"><span>{openDays.length?openDays.join(' · '):'Aucun jour spécifique'}</span><button type="button" className="table-action" onClick={addOpenDay}>+ Ajouter une date</button></div>{openDays.map(day=><button type="button" className="table-action" key={day} onClick={()=>setOpenDays(rows=>rows.filter(d=>d!==day))}>Retirer {day}</button>)}</div></Card>
      <div className="event-create-submit"><ScroleButton type="button" variant="secondary" onClick={()=>navigate('/admin/events')}>Annuler</ScroleButton><ScroleButton type="submit" disabled={saving}>{saving?'Création en cours…':'Créer et publier l’événement'}</ScroleButton></div>
    </form>
  </div>
}

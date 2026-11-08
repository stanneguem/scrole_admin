create or replace function public.admin_transfer_event_ownership(
  p_event_id uuid,
  p_new_owner_user_id uuid,
  p_admin_profile_id uuid,
  p_proof_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_previous_owner uuid;
  v_admin_actor uuid;
  v_event_name text;
  v_valid_until timestamptz;
  v_ownership public.admin_event_ownership;
begin
  if nullif(btrim(p_proof_note),'') is null then raise exception 'proof_note_required'; end if;

  select * into v_ownership from public.admin_event_ownership
  where event_id=p_event_id for update;
  if not found then raise exception 'admin_event_ownership_not_found'; end if;
  if v_ownership.ownership_type <> 'third_party' then raise exception 'only_third_party_events_can_be_transferred'; end if;
  if v_ownership.ownership_status = 'transferred' then raise exception 'event_ownership_already_transferred'; end if;

  if not exists (
    select 1 from public.user_profiles up
    where up.user_id=p_new_owner_user_id and up.deleted_at is null
      and coalesce(up.account_status,'active')='active'
  ) then raise exception 'target_user_unavailable'; end if;

  select e.creator_id,e.name into v_previous_owner,v_event_name
  from public.events e where e.id=p_event_id for update;
  if v_previous_owner is null then raise exception 'event_not_found'; end if;

  select ap.auth_id into v_admin_actor
  from public.administrateur_profil ap
  where ap.id=p_admin_profile_id and ap.actif=true;
  if v_admin_actor is null then raise exception 'admin_profile_unavailable'; end if;

  update public.event_certifications
  set valid_until=coalesce(valid_until, now() + interval '1 month'),
      updated_at=now()
  where event_id=p_event_id and status='active';

  select max(valid_until) into v_valid_until
  from public.event_certifications
  where event_id=p_event_id and status='active';

  update public.events set creator_id=p_new_owner_user_id, updated_at=now()
  where id=p_event_id;

  update public.admin_event_ownership
  set ownership_status='transferred',
      claimed_owner_user_id=p_new_owner_user_id,
      verified_by_admin_id=p_admin_profile_id,
      verified_at=now(),
      transferred_at=now(),
      updated_at=now()
  where event_id=p_event_id;

  insert into public.admin_event_ownership_history(
    event_id,action,previous_owner_user_id,new_owner_user_id,admin_profile_id,proof_note
  ) values(p_event_id,'ownership_transferred',v_previous_owner,p_new_owner_user_id,p_admin_profile_id,btrim(p_proof_note));

  insert into public.scrole_certification_audit(
    actor_user_id,entity_type,entity_id,action,previous_status,new_status,details
  )
  select v_admin_actor,'event',p_event_id,'platform_certification_handoff',
         'active','active',
         jsonb_build_object('valid_until',v_valid_until,'new_owner_user_id',p_new_owner_user_id)
  where exists(select 1 from public.event_certifications ec where ec.event_id=p_event_id and ec.status='active');

  insert into public.notifications(user_id,type,title,body,actor_id,data)
  values (
    p_new_owner_user_id,
    'event_ownership_transferred',
    'Votre événement vous a été transféré',
    'La propriété de « ' || coalesce(v_event_name,'votre événement') ||
      ' » vous a été transférée sur Scrole. L’équipe administrative effectuera une pré-analyse de l’événement et pourra vous contacter si des informations complémentaires sont nécessaires. La certification actuelle reste valable jusqu’au ' ||
      to_char(v_valid_until at time zone 'UTC','DD/MM/YYYY') ||
      ' ; son renouvellement sera ensuite à votre charge.',
    v_admin_actor,
    jsonb_build_object(
      'event_id',p_event_id,
      'event_name',coalesce(v_event_name,''),
      'ownership_status','transferred',
      'pre_analysis_required',true,
      'scheduled_deletion_at',v_valid_until,
      'certification_valid_until',v_valid_until,
      'certification_renewal_paid_by_owner',true,
      'previous_owner_user_id',v_previous_owner,
      'actor_id',v_admin_actor
    )
  );
end;
$function$;

revoke all on function public.admin_transfer_event_ownership(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_transfer_event_ownership(uuid,uuid,uuid,text) to service_role;

insert into private.notification_templates(type,language,title_template,body_template)
values
('event_ownership_transferred','fr','Votre événement vous a été transféré','La propriété de « {{event_name}} » vous a été transférée sur Scrole. L’équipe administrative effectuera une pré-analyse de l’événement et pourra vous contacter si des informations complémentaires sont nécessaires. La certification actuelle reste valable jusqu’au {{date}} ; son renouvellement sera ensuite à votre charge.'),
('event_ownership_transferred','en','Your event has been transferred to you','Ownership of “{{event_name}}” has been transferred to you on Scrole. The administrative team will conduct a preliminary review and may contact you if further information is needed. The current certification remains valid until {{date}}; renewal after that date will be at your expense.'),
('event_ownership_transferred','es','Tu evento ha sido transferido a tu cuenta','La propiedad de «{{event_name}}» se te ha transferido en Scrole. El equipo administrativo realizará una revisión preliminar y podrá contactarte si necesita más información. La certificación actual seguirá siendo válida hasta el {{date}}; después, la renovación correrá por tu cuenta.'),
('event_ownership_transferred','de','Deine Veranstaltung wurde dir übertragen','Das Eigentum an „{{event_name}}“ wurde dir auf Scrole übertragen. Das Verwaltungsteam führt eine Vorprüfung durch und kontaktiert dich gegebenenfalls bei weiteren Fragen. Die aktuelle Zertifizierung bleibt bis zum {{date}} gültig; danach musst du die Verlängerung selbst bezahlen.'),
('event_ownership_transferred','it','Il tuo evento è stato trasferito a te','La proprietà di «{{event_name}}» ti è stata trasferita su Scrole. Il team amministrativo effettuerà una verifica preliminare e potrà contattarti se servono altre informazioni. La certificazione attuale resta valida fino al {{date}}; il rinnovo successivo sarà a tuo carico.'),
('event_ownership_transferred','pt','Seu evento foi transferido para você','A propriedade de «{{event_name}}» foi transferida para você no Scrole. A equipe administrativa fará uma pré-análise e poderá entrar em contato caso precise de mais informações. A certificação atual permanece válida até {{date}}; depois disso, a renovação será por sua conta.'),
('event_ownership_transferred','zh','活动所有权已转移给你','Scrole 上“{{event_name}}”的所有权已转移给你。管理团队将进行初步审核，如需补充信息会与你联系。当前认证有效期至 {{date}}；之后的续期费用由你承担。'),
('event_ownership_transferred','ja','イベントの所有権があなたに移転されました','Scroleで「{{event_name}}」の所有権があなたに移転されました。運営チームが事前審査を行い、追加情報が必要な場合はご連絡します。現在の認証は{{date}}まで有効で、その後の更新費用は所有者の負担となります。'),
('event_ownership_transferred','ru','Ваше мероприятие передано вам','Право собственности на мероприятие «{{event_name}}» передано вам в Scrole. Администрация проведёт предварительную проверку и свяжется с вами, если понадобятся дополнительные сведения. Текущая сертификация действует до {{date}}; дальнейшее продление оплачивается вами.')
on conflict(type,language) do update
set title_template=excluded.title_template,body_template=excluded.body_template,updated_at=now();
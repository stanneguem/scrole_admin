create or replace function private.render_notification(
  p_type text,p_data jsonb,p_language text,p_fallback_title text,p_fallback_body text
)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_lang text := case when p_language in ('fr','en','es','de','it','pt','zh','ja','ru') then p_language else 'fr' end;
  v_title text; v_body text; v_activity_name text; v_event_name text;
  v_community_name text; v_salon_name text; v_actor_name text; v_reason text; v_date text;
  v_message_preview text; v_message_type text; v_planned_time text;
begin
  select title_template,body_template into v_title,v_body from private.notification_templates where type=p_type and language=v_lang;
  if v_title is null then select title_template,body_template into v_title,v_body from private.notification_templates where type=p_type and language='fr'; end if;
  if v_title is null or p_type='message_received' then return jsonb_build_object('title',p_fallback_title,'body',coalesce(p_fallback_body,'')); end if;
  if p_data ? 'activity_id' then select a.name into v_activity_name from public.activities a where a.id=(p_data->>'activity_id')::uuid; end if;
  if p_data ? 'event_id' then select e.name into v_event_name from public.events e where e.id=(p_data->>'event_id')::uuid; end if;
  if p_data ? 'community_id' then select c.name into v_community_name from public.communities c where c.id=(p_data->>'community_id')::uuid; end if;
  if p_data ? 'salon_id' then select s.name into v_salon_name from public.community_salons s where s.id=(p_data->>'salon_id')::uuid; end if;
  if p_data ? 'actor_id' then
    select coalesce(nullif(trim(concat_ws(' ',up.first_name,up.last_name)),''),nullif(up.username,''),'Quelqu’un')
    into v_actor_name from public.user_profiles up where up.user_id=(p_data->>'actor_id')::uuid;
  end if;
  if p_type='community_salon_message' and p_data ? 'message_id' then
    select m.type,
      case m.type
        when 'image' then case v_lang when 'en' then 'Photo' when 'es' then 'Foto' when 'de' then 'Foto' when 'it' then 'Foto' when 'pt' then 'Foto' when 'zh' then '照片' when 'ja' then '写真' when 'ru' then 'Фото' else 'Photo' end
        when 'video' then case v_lang when 'en' then 'Video' when 'es' then 'Vídeo' when 'de' then 'Video' when 'it' then 'Video' when 'pt' then 'Vídeo' when 'zh' then '视频' when 'ja' then '動画' when 'ru' then 'Видео' else 'Vidéo' end
        when 'audio' then case v_lang when 'en' then 'Voice message' when 'es' then 'Mensaje de voz' when 'de' then 'Sprachnachricht' when 'it' then 'Messaggio vocale' when 'pt' then 'Mensagem de voz' when 'zh' then '语音消息' when 'ja' then '音声メッセージ' when 'ru' then 'Голосовое сообщение' else 'Message audio' end
        when 'file' then case v_lang when 'en' then 'File' when 'es' then 'Archivo' when 'de' then 'Datei' when 'it' then 'File' when 'pt' then 'Arquivo' when 'zh' then '文件' when 'ja' then 'ファイル' when 'ru' then 'Файл' else 'Fichier' end
        else left(coalesce(nullif(trim(m.content),''),case v_lang when 'en' then 'Message' when 'es' then 'Mensaje' when 'de' then 'Nachricht' when 'it' then 'Messaggio' when 'pt' then 'Mensagem' when 'zh' then '消息' when 'ja' then 'メッセージ' when 'ru' then 'Сообщение' else 'Message' end),140)
      end into v_message_type,v_message_preview
    from public.community_salon_messages m where m.id=(p_data->>'message_id')::uuid and m.salon_id=(p_data->>'salon_id')::uuid and not m.is_deleted;
  end if;
  v_actor_name:=coalesce(v_actor_name,p_data->>'actor_name','Quelqu’un');
  v_community_name:=coalesce(v_community_name,p_data->>'community_name','');
  v_salon_name:=coalesce(v_salon_name,p_data->>'salon_name','');
  v_message_preview:=coalesce(v_message_preview,p_data->>'message_preview',
    case v_lang when 'en' then 'New message' when 'es' then 'Nuevo mensaje' when 'de' then 'Neue Nachricht' when 'it' then 'Nuovo messaggio' when 'pt' then 'Nova mensagem' when 'zh' then '新消息' when 'ja' then '新しいメッセージ' when 'ru' then 'Новое сообщение' else 'Nouveau message' end);
  v_reason:=coalesce(p_data->>'raison','');
  if p_data ? 'certification_valid_until' then v_date:=to_char((p_data->>'certification_valid_until')::timestamptz,'DD/MM/YYYY');
  elsif p_data ? 'scheduled_deletion_at' then v_date:=to_char((p_data->>'scheduled_deletion_at')::timestamptz,'DD/MM/YYYY'); end if;
  v_planned_time:=coalesce(p_data->>'planned_time','');
  v_title:=replace(replace(replace(replace(replace(replace(replace(replace(replace(v_title,
    '{{activity_name}}',coalesce(v_activity_name,p_data->>'activity_name','')),'{{event_name}}',coalesce(v_event_name,p_data->>'event_name','')),
    '{{community_name}}',v_community_name),'{{salon_name}}',v_salon_name),'{{actor_name}}',v_actor_name),
    '{{message_preview}}',v_message_preview),'{{raison}}',v_reason),'{{date}}',coalesce(v_date,'')),'{{planned_time}}',v_planned_time);
  v_body:=replace(replace(replace(replace(replace(replace(replace(replace(replace(v_body,
    '{{activity_name}}',coalesce(v_activity_name,p_data->>'activity_name','')),'{{event_name}}',coalesce(v_event_name,p_data->>'event_name','')),
    '{{community_name}}',v_community_name),'{{salon_name}}',v_salon_name),'{{actor_name}}',v_actor_name),
    '{{message_preview}}',v_message_preview),'{{raison}}',v_reason),'{{date}}',coalesce(v_date,'')),'{{planned_time}}',v_planned_time);
  return jsonb_build_object('title',v_title,'body',v_body);
end
$function$;

create or replace function public.admin_transfer_event_ownership(
 p_event_id uuid,p_new_owner_user_id uuid,p_admin_profile_id uuid,p_proof_note text
) returns void language plpgsql security definer set search_path=''
as $function$
declare v_previous_owner uuid; v_admin_actor uuid; v_event_name text; v_valid_until timestamptz; v_ownership public.admin_event_ownership;
begin
 if nullif(btrim(p_proof_note),'') is null then raise exception 'proof_note_required'; end if;
 select * into v_ownership from public.admin_event_ownership where event_id=p_event_id for update;
 if not found then raise exception 'admin_event_ownership_not_found'; end if;
 if v_ownership.ownership_type<>'third_party' then raise exception 'only_third_party_events_can_be_transferred'; end if;
 if v_ownership.ownership_status='transferred' then raise exception 'event_ownership_already_transferred'; end if;
 if not exists(select 1 from public.user_profiles up where up.user_id=p_new_owner_user_id and up.deleted_at is null and coalesce(up.account_status,'active')='active') then raise exception 'target_user_unavailable'; end if;
 select e.creator_id,e.name into v_previous_owner,v_event_name from public.events e where e.id=p_event_id for update;
 if v_previous_owner is null then raise exception 'event_not_found'; end if;
 select ap.auth_id into v_admin_actor from public.administrateur_profil ap where ap.id=p_admin_profile_id and ap.actif=true;
 if v_admin_actor is null then raise exception 'admin_profile_unavailable'; end if;
 if not exists(select 1 from public.event_certifications ec where ec.event_id=p_event_id and ec.status='active' and (ec.valid_until is null or ec.valid_until>now())) then raise exception 'active_event_certification_required_for_transfer'; end if;
 update public.event_certifications set valid_until=coalesce(valid_until,now()+interval '1 month'),updated_at=now()
 where event_id=p_event_id and status='active' and (valid_until is null or valid_until>now());
 select max(valid_until) into v_valid_until from public.event_certifications where event_id=p_event_id and status='active' and valid_until>now();
 update public.events set creator_id=p_new_owner_user_id,updated_at=now() where id=p_event_id;
 update public.admin_event_ownership set ownership_status='transferred',claimed_owner_user_id=p_new_owner_user_id,verified_by_admin_id=p_admin_profile_id,verified_at=now(),transferred_at=now(),updated_at=now() where event_id=p_event_id;
 insert into public.admin_event_ownership_history(event_id,action,previous_owner_user_id,new_owner_user_id,admin_profile_id,proof_note) values(p_event_id,'ownership_transferred',v_previous_owner,p_new_owner_user_id,p_admin_profile_id,btrim(p_proof_note));
 insert into public.scrole_certification_audit(actor_user_id,entity_type,entity_id,action,previous_status,new_status,details)
 values(v_admin_actor,'event',p_event_id,'platform_certification_handoff','active','active',jsonb_build_object('valid_until',v_valid_until,'new_owner_user_id',p_new_owner_user_id));
 insert into public.notifications(user_id,type,title,body,actor_id,data) values(
 p_new_owner_user_id,'event_ownership_transferred','Votre événement vous a été transféré',
 'La propriété de « '||coalesce(v_event_name,'votre événement')||' » vous a été transférée sur Scrole. L’équipe administrative effectuera une pré-analyse de l’événement et pourra vous contacter si des informations complémentaires sont nécessaires. La certification actuelle reste valable jusqu’au '||to_char(v_valid_until at time zone 'UTC','DD/MM/YYYY')||' ; son renouvellement sera ensuite à votre charge.',
 v_admin_actor,jsonb_build_object('event_id',p_event_id,'event_name',coalesce(v_event_name,''),'ownership_status','transferred','pre_analysis_required',true,'certification_valid_until',v_valid_until,'certification_renewal_paid_by_owner',true,'previous_owner_user_id',v_previous_owner,'actor_id',v_admin_actor));
end
$function$;
revoke all on function public.admin_transfer_event_ownership(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_transfer_event_ownership(uuid,uuid,uuid,text) to service_role;
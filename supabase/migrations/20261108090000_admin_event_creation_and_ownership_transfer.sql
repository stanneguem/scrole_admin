-- Admin-created events and auditable third-party ownership transfers.
create table if not exists public.admin_event_ownership (
 event_id uuid primary key references public.events(id) on delete cascade,
 ownership_type text not null check(ownership_type in('platform','third_party')),
 ownership_status text not null check(ownership_status in('platform_owned','awaiting_proof','transferred')),
 claimed_owner_user_id uuid references public.user_profiles(user_id) on delete set null,
 created_by_admin_id uuid not null references public.administrateur_profil(id),
 ownership_note text, verified_by_admin_id uuid references public.administrateur_profil(id),
 verified_at timestamptz, transferred_at timestamptz,
 updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists public.admin_event_ownership_history (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 action text not null check(action in('created_platform','created_third_party','ownership_transferred')),
 previous_owner_user_id uuid, new_owner_user_id uuid,
 admin_profile_id uuid not null references public.administrateur_profil(id),
 proof_note text, created_at timestamptz not null default now()
);
alter table public.admin_event_ownership enable row level security;
alter table public.admin_event_ownership_history enable row level security;
revoke all on public.admin_event_ownership from anon,authenticated;
revoke all on public.admin_event_ownership_history from anon,authenticated;
grant all on public.admin_event_ownership to service_role;

create or replace function public.admin_create_event_from_console(
 p_creator_id uuid,p_admin_profile_id uuid,p_event jsonb,p_activities jsonb default '[]'::jsonb,
 p_tickets jsonb default '[]'::jsonb,p_restrictions jsonb default '{}'::jsonb,
 p_open_days jsonb default '[]'::jsonb,p_ownership_type text default 'platform',p_ownership_note text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare
 v_event_id uuid:=gen_random_uuid(); v_slug text; v_activity jsonb; v_ticket jsonb; v_activity_id uuid; v_day jsonb; v_genders text[];
begin
 if p_creator_id is null or p_admin_profile_id is null then raise exception 'admin_context_required'; end if;
 if p_ownership_type not in('platform','third_party') then raise exception 'invalid_ownership_type'; end if;
 if nullif(btrim(p_event->>'name'),'') is null then raise exception 'event_name_required'; end if;
 if nullif(btrim(p_event->>'starts_at'),'') is null then raise exception 'event_start_required'; end if;
 if coalesce((p_event->>'is_virtual')::boolean,false) then
  if nullif(btrim(p_event->>'virtual_link'),'') is null then raise exception 'virtual_link_required'; end if;
 else
  if nullif(p_event->>'country_id','') is null or nullif(p_event->>'city_id','') is null or nullif(btrim(p_event->>'address'),'') is null then raise exception 'physical_location_required'; end if;
  if not exists(select 1 from public.cities c where c.id=(p_event->>'city_id')::uuid and c.country_id=(p_event->>'country_id')::uuid and coalesce(c.is_active,true)) then raise exception 'invalid_event_city'; end if;
 end if;
 v_slug:=coalesce(nullif(btrim(p_event->>'slug'),''),lower(regexp_replace(btrim(p_event->>'name'),'[^a-zA-Z0-9]+','-','g'))||'-'||substr(v_event_id::text,1,8));
 insert into public.events(id,creator_id,name,slug,description,photo,country_id,city_id,starts_at,ends_at,is_free,status,is_virtual,virtual_link,address,is_public,real_created_at,updated_at)
 values(v_event_id,p_creator_id,btrim(p_event->>'name'),v_slug,nullif(p_event->>'description',''),nullif(p_event->>'photo',''),
 nullif(p_event->>'country_id','')::uuid,nullif(p_event->>'city_id','')::uuid,(p_event->>'starts_at')::timestamptz,
 nullif(p_event->>'ends_at','')::timestamptz,coalesce((p_event->>'is_free')::boolean,false),'active',
 coalesce((p_event->>'is_virtual')::boolean,false),nullif(p_event->>'virtual_link',''),nullif(p_event->>'address',''),
 coalesce((p_event->>'is_public')::boolean,true),nullif(p_event->>'real_created_at','')::date,now());
 for v_activity in select value from jsonb_array_elements(coalesce(p_activities,'[]'::jsonb)) loop
  if nullif(btrim(v_activity->>'name'),'') is null then continue; end if;
  v_activity_id:=gen_random_uuid();
  insert into public.activities(id,creator_id,name,description,base_price,currency_code,status,event_only)
  values(v_activity_id,p_creator_id,btrim(v_activity->>'name'),nullif(v_activity->>'description',''),coalesce(nullif(v_activity->>'base_price','')::numeric,0),coalesce(nullif(v_activity->>'currency_code',''),'XAF'),'active',true);
  insert into public.event_activities(event_id,activity_id,price,added_by) values(v_event_id,v_activity_id,coalesce(nullif(v_activity->>'event_price','')::numeric,0),p_creator_id);
 end loop;
 for v_ticket in select value from jsonb_array_elements(coalesce(p_tickets,'[]'::jsonb)) loop
  if nullif(btrim(v_ticket->>'name'),'') is null then continue; end if;
  insert into public.event_tickets(event_id,name,price,currency_code) values(v_event_id,btrim(v_ticket->>'name'),coalesce(nullif(v_ticket->>'price','')::numeric,0),coalesce(nullif(v_ticket->>'currency_code',''),'XAF'));
 end loop;
 if coalesce(p_restrictions,'{}'::jsonb)<>'{}'::jsonb then
  v_genders:=array(select jsonb_array_elements_text(coalesce(p_restrictions->'allowed_genders','[]'::jsonb)));
  insert into public.event_restrictions(event_id,min_age,max_age,serves_alcohol,overnight_event,id_required,smoking_allowed,other_restrictions,allowed_genders,updated_at)
  values(v_event_id,nullif(p_restrictions->>'min_age','')::integer,nullif(p_restrictions->>'max_age','')::integer,
  coalesce((p_restrictions->>'serves_alcohol')::boolean,false),coalesce((p_restrictions->>'overnight_event')::boolean,false),
  coalesce((p_restrictions->>'id_required')::boolean,false),coalesce((p_restrictions->>'smoking_allowed')::boolean,false),
  nullif(p_restrictions->>'other_restrictions',''),
  case when cardinality(v_genders)>0 then v_genders::public.genre_enum[] else array['homme','femme']::public.genre_enum[] end,now());
 end if;
 for v_day in select value from jsonb_array_elements(coalesce(p_open_days,'[]'::jsonb)) loop
  insert into public.event_open_days(event_id,event_date) values(v_event_id,(v_day#>>'{}')::date) on conflict do nothing;
 end loop;
 insert into public.admin_event_ownership(event_id,ownership_type,ownership_status,created_by_admin_id,ownership_note)
 values(v_event_id,p_ownership_type,case when p_ownership_type='platform' then 'platform_owned' else 'awaiting_proof' end,p_admin_profile_id,nullif(p_ownership_note,''));
 insert into public.admin_event_ownership_history(event_id,action,previous_owner_user_id,new_owner_user_id,admin_profile_id,proof_note)
 values(v_event_id,case when p_ownership_type='platform' then 'created_platform' else 'created_third_party' end,null,p_creator_id,p_admin_profile_id,nullif(p_ownership_note,''));
 return v_event_id;
end;$function$;

create or replace function public.admin_transfer_event_ownership(p_event_id uuid,p_new_owner_user_id uuid,p_admin_profile_id uuid,p_proof_note text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_previous_owner uuid; v_ownership public.admin_event_ownership;
begin
 if nullif(btrim(p_proof_note),'') is null then raise exception 'proof_note_required'; end if;
 select * into v_ownership from public.admin_event_ownership where event_id=p_event_id for update;
 if not found then raise exception 'admin_event_ownership_not_found'; end if;
 if v_ownership.ownership_type<>'third_party' then raise exception 'only_third_party_events_can_be_transferred'; end if;
 if v_ownership.ownership_status='transferred' then raise exception 'event_ownership_already_transferred'; end if;
 if not exists(select 1 from public.user_profiles up where up.user_id=p_new_owner_user_id and up.deleted_at is null and coalesce(up.account_status,'active')='active') then raise exception 'target_user_unavailable'; end if;
 select creator_id into v_previous_owner from public.events where id=p_event_id for update;
 if v_previous_owner is null then raise exception 'event_not_found'; end if;
 update public.events set creator_id=p_new_owner_user_id,updated_at=now() where id=p_event_id;
 update public.admin_event_ownership set ownership_status='transferred',claimed_owner_user_id=p_new_owner_user_id,verified_by_admin_id=p_admin_profile_id,verified_at=now(),transferred_at=now(),updated_at=now() where event_id=p_event_id;
 insert into public.admin_event_ownership_history(event_id,action,previous_owner_user_id,new_owner_user_id,admin_profile_id,proof_note)
 values(p_event_id,'ownership_transferred',v_previous_owner,p_new_owner_user_id,p_admin_profile_id,btrim(p_proof_note));
end;$function$;
revoke all on function public.admin_create_event_from_console(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.admin_create_event_from_console(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text) to service_role;
revoke all on function public.admin_transfer_event_ownership(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_transfer_event_ownership(uuid,uuid,uuid,text) to service_role;
insert into public.admin_role_permissions(role,permission,enabled) values
('admin','events.create',true),('admin','events.transfer_ownership',true),('super_admin','events.create',true),('super_admin','events.transfer_ownership',true)
on conflict(role,permission) do update set enabled=excluded.enabled,updated_at=now();

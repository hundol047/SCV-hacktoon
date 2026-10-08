alter table public.bopok_reviews add column if not exists approved_at timestamptz;
create table if not exists public.bopok_operations(id boolean primary key default true check(id),alert_at timestamptz,backup_verified_at timestamptz);
insert into public.bopok_operations(id) values(true) on conflict do nothing;
alter table public.bopok_operations enable row level security;
revoke all on public.bopok_operations from public;
create or replace function public.bopok_alert(p_action text default 'reserve') returns jsonb language plpgsql security definer set search_path='' as $$
declare stamp timestamptz;
begin
 select alert_at into stamp from public.bopok_operations where id=true for update;
 if p_action='release' then update public.bopok_operations set alert_at=null where id=true;return jsonb_build_object('released',true);end if;
 if p_action<>'reserve' then return jsonb_build_object('error','invalid');end if;
 if stamp>now()-interval '30 minutes' then return jsonb_build_object('allowed',false);end if;
 update public.bopok_operations set alert_at=now() where id=true;return jsonb_build_object('allowed',true);
end $$;
create or replace function public.bopok_backup_record() returns jsonb language sql security definer set search_path='' as $$
 update public.bopok_operations set backup_verified_at=now() where id=true returning jsonb_build_object('verifiedAt',backup_verified_at);
$$;
revoke all on function public.bopok_alert(text),public.bopok_backup_record() from public;
grant execute on function public.bopok_alert(text),public.bopok_backup_record() to service_role;
insert into public.bopok_schema_versions(version) values(7) on conflict do nothing;

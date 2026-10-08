-- Upgrade diagnostics, aggregate operational metrics, and reusable retention.
create table if not exists public.bopok_schema_versions(version integer primary key,applied_at timestamptz not null default now());
create table if not exists public.bopok_metrics(bucket timestamptz not null,event text not null,code text not null,count bigint not null default 0,total numeric not null default 0,maximum numeric not null default 0,primary key(bucket,event,code));
create table if not exists public.bopok_maintenance_log(id boolean primary key default true check(id),finished_at timestamptz not null,deleted_trips integer not null,deleted_cache integer not null);
alter table public.bopok_schema_versions enable row level security;
alter table public.bopok_metrics enable row level security;
alter table public.bopok_maintenance_log enable row level security;
revoke all on public.bopok_schema_versions,public.bopok_metrics,public.bopok_maintenance_log from public;
insert into public.bopok_schema_versions(version) values(5) on conflict do nothing;

create or replace function public.bopok_health(p_required integer default 5) returns jsonb language plpgsql security definer set search_path='' as $$
declare installed integer; identity_ready boolean; quota_ready boolean; scheduled boolean:=false; last_success timestamptz; last_failure timestamptz; cleanup timestamptz;
begin
 select coalesce(max(version),0) into installed from public.bopok_schema_versions;
 identity_ready:=to_regprocedure('public.bopok_identity(text,text,text)') is not null and to_regclass('public.bopok_owners') is not null;
 quota_ready:=coalesce(pg_get_functiondef(to_regprocedure('public.bopok_reserve(text,integer,numeric,integer,integer,bigint,numeric,text)')) like '%''session''%',false);
 select finished_at into cleanup from public.bopok_maintenance_log where id=true;
 if to_regclass('cron.job') is not null then
  execute 'select exists(select 1 from cron.job where jobname=''bopok-retention'' and active)' into scheduled;
  if to_regclass('cron.job_run_details') is not null then
   execute 'select max(end_time) filter(where status=''succeeded''),max(end_time) filter(where status=''failed'') from cron.job_run_details where jobid in (select jobid from cron.job where jobname=''bopok-retention'')' into last_success,last_failure;
  end if;
 end if;
 return jsonb_build_object('schemaVersion',installed,'requiredVersion',p_required,'ready',installed>=p_required and identity_ready and quota_ready,'features',jsonb_build_object('identity',identity_ready,'quotas',quota_ready,'accounts',to_regprocedure('public.bopok_claim(text,text)') is not null,'reviews',to_regclass('public.bopok_reviews') is not null),'maintenance',jsonb_build_object('scheduled',scheduled,'lastSuccessAt',last_success,'lastFailureAt',last_failure,'lastCleanupAt',cleanup));
end $$;

create or replace function public.bopok_metric(p_event text,p_code text default 'ok',p_value numeric default 0) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_event='report' then return jsonb_build_object('metrics',coalesce((select jsonb_agg(jsonb_build_object('event',event,'code',code,'count',n,'total',s,'maximum',m)) from (select event,code,sum(count) n,sum(total) s,max(maximum) m from public.bopok_metrics where bucket>=now()-interval '24 hours' group by event,code) q),'[]'::jsonb)); end if;
 if p_event not in ('storage','auth','catalog','routing','ai','quota','maintenance','backup','alert') or p_code !~ '^[a-z0-9_]{1,32}$' or p_value<0 or p_value>10000000 then return jsonb_build_object('error','invalid'); end if;
 insert into public.bopok_metrics(bucket,event,code,count,total,maximum) values(date_trunc('hour',now()),p_event,p_code,1,p_value,p_value) on conflict(bucket,event,code) do update set count=bopok_metrics.count+1,total=bopok_metrics.total+excluded.total,maximum=greatest(bopok_metrics.maximum,excluded.maximum);
 return jsonb_build_object('recorded',true);
end $$;

create or replace function public.bopok_maintenance() returns jsonb language plpgsql security definer set search_path='' as $$
declare trips integer; cache_rows integer;
begin
 delete from public.bopok_trips where expires_at<=now();get diagnostics trips=row_count;
 delete from public.bopok_owners where expires_at<=now();
 delete from public.bopok_invites where expires_at<=now();
 delete from public.bopok_public_cache where expires_at<=now();get diagnostics cache_rows=row_count;
 delete from public.bopok_quotas where bucket like 'minute:%' and split_part(bucket,':',3)::bigint<floor(extract(epoch from now()-interval '2 days')/60);
 delete from public.bopok_quotas where bucket like 'daily:%' and split_part(bucket,':',3)::date<current_date-45;
 delete from public.bopok_metrics where bucket<now()-interval '30 days';
 if to_regclass('public.bopok_reviews') is not null then execute 'delete from public.bopok_reviews where expires_at<=now()'; end if;
 insert into public.bopok_maintenance_log(id,finished_at,deleted_trips,deleted_cache) values(true,now(),trips,cache_rows) on conflict(id) do update set finished_at=excluded.finished_at,deleted_trips=excluded.deleted_trips,deleted_cache=excluded.deleted_cache;
 perform public.bopok_metric('maintenance','ok',trips+cache_rows);
 return jsonb_build_object('deletedTrips',trips,'deletedCache',cache_rows);
end $$;
revoke all on function public.bopok_health(integer),public.bopok_metric(text,text,numeric),public.bopok_maintenance() from public;
grant execute on function public.bopok_health(integer),public.bopok_metric(text,text,numeric),public.bopok_maintenance() to service_role;

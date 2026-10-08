-- Persist recent, configuration-bound provider checks and 15-minute operational metrics.
create table public.bopok_provider_checks(name text primary key, fingerprint text not null,ok boolean not null,code text not null,checked_at timestamptz not null default now());
alter table public.bopok_provider_checks enable row level security;
revoke all on public.bopok_provider_checks from public;
create function public.bopok_provider(p_action text default 'report',p_name text default '',p_fingerprint text default '',p_ok boolean default false,p_code text default 'failed') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_action='report' then return jsonb_build_object('checks',coalesce((select jsonb_agg(jsonb_build_object('name',name,'fingerprint',fingerprint,'ok',ok,'code',code,'checkedAt',checked_at)) from public.bopok_provider_checks),'[]'::jsonb));end if;
 if p_action<>'record' or p_name not in ('auth','routing','transit','ai','bot','catalog','fx') or p_fingerprint !~ '^[a-f0-9]{64}$' or p_code !~ '^[a-z0-9_]{1,32}$' then return jsonb_build_object('error','invalid');end if;
 insert into public.bopok_provider_checks(name,fingerprint,ok,code) values(p_name,p_fingerprint,p_ok,p_code) on conflict(name) do update set fingerprint=excluded.fingerprint,ok=excluded.ok,code=excluded.code,checked_at=now();
 return jsonb_build_object('recorded',true);
end $$;
revoke all on function public.bopok_provider(text,text,text,boolean,text) from public;
grant execute on function public.bopok_provider(text,text,text,boolean,text) to service_role;
alter function public.bopok_health(integer) rename to bopok_health_v11;
revoke all on function public.bopok_health_v11(integer) from public,service_role;
create function public.bopok_health(p_required integer default 12) returns jsonb language sql security definer set search_path='' as $$
 select public.bopok_health_v11(p_required)||jsonb_build_object('contractVersion',12,'providers',(public.bopok_provider()->'checks'));
$$;
revoke all on function public.bopok_health(integer) from public;
grant execute on function public.bopok_health(integer) to service_role;
alter table public.bopok_metrics add column slow_count bigint not null default 0;
create or replace function public.bopok_metric(p_event text,p_code text default 'ok',p_value numeric default 0) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_event='report' then return jsonb_build_object('windowMinutes',15,'metrics',coalesce((select jsonb_agg(jsonb_build_object('event',event,'code',code,'count',n,'total',s,'maximum',m,'slowCount',slow)) from (select event,code,sum(count) n,sum(total) s,max(maximum) m,sum(slow_count) slow from public.bopok_metrics where bucket>=date_trunc('minute',now())-interval '14 minutes' group by event,code) q),'[]'::jsonb));end if;
 if p_event not in ('storage','auth','catalog','routing','ai','quota','maintenance','backup','alert') or p_code !~ '^[a-z0-9_]{1,32}$' or p_value<0 or p_value>10000000 then return jsonb_build_object('error','invalid');end if;
 insert into public.bopok_metrics(bucket,event,code,count,total,maximum,slow_count) values(date_trunc('minute',now()),p_event,p_code,1,p_value,p_value,case when p_value>=2000 then 1 else 0 end) on conflict(bucket,event,code) do update set count=bopok_metrics.count+1,total=bopok_metrics.total+excluded.total,maximum=greatest(bopok_metrics.maximum,excluded.maximum),slow_count=bopok_metrics.slow_count+excluded.slow_count;
 return jsonb_build_object('recorded',true);
end $$;
insert into public.bopok_schema_versions(version) values(12);

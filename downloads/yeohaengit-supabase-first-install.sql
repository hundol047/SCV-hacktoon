-- Yeohaengit first installation only. Run the ENTIRE file in Supabase SQL Editor.
-- Stops on existing public.bopok_* relations/functions; never upgrades or overwrites them.
-- Includes core schema and AI quota RPC. Automatic retention scheduling is separate.
BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND left(c.relname,6)='bopok_')
 OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND left(p.proname,6)='bopok_')
 THEN RAISE EXCEPTION 'Existing bopok objects found. Installation stopped; inspect existing schema first.';
 END IF;
END $$;

-- 001_bopok
-- Execute in Supabase SQL Editor. No browser/anon policies: only the server service role can call these RPCs.
create table if not exists public.bopok_trips (
 id uuid primary key default gen_random_uuid(), owner_hash text not null,
 payload jsonb not null, storage_version integer not null default 0,
 expires_at timestamptz not null default now()+interval '30 days'
);
create index if not exists bopok_trips_owner on public.bopok_trips(owner_hash);
create table if not exists public.bopok_invites (
 token_hash text primary key, trip_id uuid not null references public.bopok_trips(id) on delete cascade,
 role text not null check(role in ('viewer','editor')), expires_at timestamptz not null default now()+interval '7 days'
);
create table if not exists public.bopok_quotas (bucket text primary key, requests integer not null default 0, tokens bigint not null default 0, cost numeric not null default 0);
create table if not exists public.bopok_public_cache (key text primary key, value jsonb not null, expires_at timestamptz not null);
alter table public.bopok_trips enable row level security;
alter table public.bopok_invites enable row level security;
alter table public.bopok_quotas enable row level security;
alter table public.bopok_public_cache enable row level security;
revoke all on public.bopok_trips,public.bopok_invites,public.bopok_quotas,public.bopok_public_cache from public;

create or replace function public.bopok_trip(p_action text,p_owner text default '',p_id uuid default null,p_token text default '',p_payload jsonb default null,p_expected integer default null,p_role text default 'viewer') returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.bopok_trips; r text; result_id uuid; f jsonb;
begin
 if p_action='health' then return jsonb_build_object('ready',true); end if;
 if p_action='create' then
  if p_owner !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','forbidden'); end if;
  perform pg_advisory_xact_lock(hashtext(p_owner));
  if (select count(*) from public.bopok_trips where owner_hash=p_owner and expires_at>now())>=20 then return jsonb_build_object('error','limit'); end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>524288 then return jsonb_build_object('error','invalid'); end if;
  insert into public.bopok_trips(owner_hash,payload) values(p_owner,p_payload) returning id into result_id;
  return jsonb_build_object('id',result_id,'storageVersion',0,'role','owner','trip',p_payload);
 end if;
 if p_action='list' then return jsonb_build_object('trips',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',payload->'basics'->>'title','expiresAt',expires_at)) from public.bopok_trips where owner_hash=p_owner and expires_at>now()),'[]'::jsonb)); end if;
 if p_action='delete-all' then delete from public.bopok_trips where owner_hash=p_owner; return jsonb_build_object('deleted',true); end if;
 select * into t from public.bopok_trips where id=p_id and expires_at>now() for update;
 if not found then return jsonb_build_object('error','not_found'); end if;
 if t.owner_hash=p_owner then r:='owner'; else select role into r from public.bopok_invites where trip_id=p_id and token_hash=p_token and expires_at>now(); end if;
 if r is null then return jsonb_build_object('error','forbidden'); end if;
 if p_action='get' then return jsonb_build_object('id',t.id,'storageVersion',t.storage_version,'role',r,'trip',t.payload,'expiresAt',t.expires_at); end if;
 if p_action='update' then
  if r not in ('owner','editor') then return jsonb_build_object('error','forbidden'); end if;
  if p_expected is distinct from t.storage_version then return jsonb_build_object('error','conflict','storageVersion',t.storage_version); end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>524288 then return jsonb_build_object('error','invalid'); end if;
  -- Concurrent parent feedback is merged, never replaced by an older owner's draft.
  select coalesce(jsonb_agg(x),'[]'::jsonb) into f from (select x from (select distinct on (x->>'id') x from jsonb_array_elements(coalesce(t.payload->'feedback','[]')||coalesce(p_payload->'feedback','[]')) x order by x->>'id',x->>'at' desc) unique_feedback order by x->>'at' desc limit 30) u;
  update public.bopok_trips set payload=jsonb_set(p_payload,'{feedback}',f),storage_version=storage_version+1,expires_at=now()+interval '30 days' where id=p_id returning * into t;
 elsif p_action='feedback' then
  if p_payload->>'text' is null or p_payload->>'text' not in ('좋아요','걷는 구간을 줄여 주세요','쉬는 시간을 늘려 주세요','식사를 바꾸고 싶어요') then return jsonb_build_object('error','invalid'); end if;
  f:=jsonb_build_object('id',gen_random_uuid(),'text',p_payload->>'text','at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  update public.bopok_trips set payload=jsonb_set(payload,'{feedback}',coalesce((select jsonb_agg(x) from (select x from jsonb_array_elements(coalesce(payload->'feedback','[]')||jsonb_build_array(f)) with ordinality u(x,n) order by n desc limit 30) v),'[]')),storage_version=storage_version+1 where id=p_id returning * into t;
 elsif p_action='invite' then
  if r<>'owner' or p_token !~ '^[a-f0-9]{64}$' or p_role not in ('viewer','editor') then return jsonb_build_object('error','forbidden'); end if;
  if (select count(*) from public.bopok_invites where trip_id=p_id and expires_at>now())>=10 then return jsonb_build_object('error','limit'); end if;
  insert into public.bopok_invites(token_hash,trip_id,role) values(p_token,p_id,p_role);
  return jsonb_build_object('created',true,'expiresAt',now()+interval '7 days');
 elsif p_action='revoke' then
  if r<>'owner' then return jsonb_build_object('error','forbidden'); end if;
  delete from public.bopok_invites where trip_id=p_id; return jsonb_build_object('revoked',true);
 elsif p_action='delete' then
  if r<>'owner' then return jsonb_build_object('error','forbidden'); end if;
  delete from public.bopok_trips where id=p_id; return jsonb_build_object('deleted',true);
 else return jsonb_build_object('error','invalid'); end if;
 return jsonb_build_object('id',t.id,'storageVersion',t.storage_version,'role',r,'trip',t.payload);
end $$;

create or replace function public.bopok_reserve(p_subject text,p_tokens integer default 0,p_cost numeric default 0,p_minute_limit integer default 10,p_daily_requests integer default 500,p_daily_tokens bigint default 1000000,p_daily_cost numeric default 5,p_scope text default 'general') returns jsonb
language plpgsql security definer set search_path='' as $$
declare m text; d text; minute_row public.bopok_quotas; day_row public.bopok_quotas;
begin
 if p_scope not in ('general','ai','feedback','route') or p_subject !~ '^[a-f0-9]{64}$' or p_tokens<0 or p_cost<0 then return jsonb_build_object('allowed',false); end if;
 perform pg_advisory_xact_lock(hashtext('bopok-global-quotas'));
 m:='minute:'||p_subject||':'||floor(extract(epoch from now())/60)::text;
 d:='daily:'||p_scope||':'||to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD');
 insert into public.bopok_quotas(bucket) values(m),(d) on conflict do nothing;
 select * into minute_row from public.bopok_quotas where bucket=m;
 select * into day_row from public.bopok_quotas where bucket=d;
 if minute_row.requests>=p_minute_limit or day_row.requests>=p_daily_requests or day_row.tokens+p_tokens>p_daily_tokens or day_row.cost+p_cost>p_daily_cost then return jsonb_build_object('allowed',false,'reason','quota'); end if;
 update public.bopok_quotas set requests=requests+1 where bucket=m;
 update public.bopok_quotas set requests=requests+1,tokens=tokens+p_tokens,cost=cost+p_cost where bucket=d;
 return jsonb_build_object('allowed',true,'reservedTokens',p_tokens,'reservedCostUsd',p_cost,'remainingRequests',p_daily_requests-day_row.requests-1);
end $$;

create or replace function public.bopok_cache(p_key text,p_value jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_value is not null then insert into public.bopok_public_cache(key,value,expires_at) values(p_key,p_value,now()+interval '1 day') on conflict(key) do update set value=excluded.value,expires_at=excluded.expires_at; return p_value; end if;
 return (select value from public.bopok_public_cache where key=p_key and expires_at>now());
end $$;
revoke all on function public.bopok_trip(text,text,uuid,text,jsonb,integer,text),public.bopok_reserve(text,integer,numeric,integer,integer,bigint,numeric,text),public.bopok_cache(text,jsonb) from public;
grant execute on function public.bopok_trip(text,text,uuid,text,jsonb,integer,text),public.bopok_reserve(text,integer,numeric,integer,integer,bigint,numeric,text),public.bopok_cache(text,jsonb) to service_role;

create or replace function public.bopok_geo_guard(p_provider text) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; wait_seconds integer;
begin
 if p_provider not in ('nominatim','overpass') then return jsonb_build_object('allowed',false); end if;
 k:='guard:'||p_provider;wait_seconds:=case when p_provider='nominatim' then 2 else 10 end;
 perform pg_advisory_xact_lock(hashtext(k));
 if exists(select 1 from public.bopok_public_cache where key=k and expires_at>now()) then return jsonb_build_object('allowed',false); end if;
 insert into public.bopok_public_cache(key,value,expires_at) values(k,'{}',now()+make_interval(secs=>wait_seconds)) on conflict(key) do update set expires_at=excluded.expires_at;
 return jsonb_build_object('allowed',true);
end $$;
revoke all on function public.bopok_geo_guard(text) from public;
grant execute on function public.bopok_geo_guard(text) to service_role;


-- 003_audit_fixes
-- Apply after 001; upgrades existing installations without deleting trips.
create or replace function public.bopok_trip(p_action text,p_owner text default '',p_id uuid default null,p_token text default '',p_payload jsonb default null,p_expected integer default null,p_role text default 'viewer') returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.bopok_trips; r text; result_id uuid; f jsonb; new_bytes bigint; occupied_bytes bigint;
begin
 if p_action='health' then return jsonb_build_object('ready',true); end if;
 if p_action in ('create','update','feedback') then perform pg_advisory_xact_lock(hashtext('bopok-storage')); end if;
 if p_action='create' then
  if p_owner !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','forbidden'); end if;
  perform pg_advisory_xact_lock(hashtext(p_owner));
  if p_payload->>'id' is not null then
   select * into t from public.bopok_trips where owner_hash=p_owner and payload->>'id'=p_payload->>'id' and expires_at>now() order by expires_at desc limit 1;
   if found then return jsonb_build_object('id',t.id,'storageVersion',t.storage_version,'role','owner','trip',t.payload,'expiresAt',t.expires_at); end if;
  end if;
  if (select count(*) from public.bopok_trips)>=2000 then return jsonb_build_object('error','capacity'); end if;
  if (select count(*) from public.bopok_trips where owner_hash=p_owner and expires_at>now())>=20 then return jsonb_build_object('error','limit'); end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>524288 then return jsonb_build_object('error','invalid'); end if;
  if coalesce((select sum(octet_length(payload::text)) from public.bopok_trips),0)+octet_length(p_payload::text)>262144000 then return jsonb_build_object('error','capacity'); end if;
  insert into public.bopok_trips(owner_hash,payload) values(p_owner,p_payload) returning id into result_id;
  return jsonb_build_object('id',result_id,'storageVersion',0,'role','owner','trip',p_payload);
 end if;
 if p_action='find' then
  if p_owner !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','forbidden'); end if;
  select id into p_id from public.bopok_trips where owner_hash=p_owner and payload->>'id'=p_payload->>'id' and expires_at>now() order by expires_at desc limit 1;
 end if;
 if p_action='list' then return jsonb_build_object('trips',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',payload->'basics'->>'title','expiresAt',expires_at)) from public.bopok_trips where owner_hash=p_owner and expires_at>now()),'[]'::jsonb)); end if;
 if p_action='delete-all' then delete from public.bopok_trips where owner_hash=p_owner; return jsonb_build_object('deleted',true); end if;
 select * into t from public.bopok_trips where id=p_id and expires_at>now() for update;
 if not found then return jsonb_build_object('error','not_found'); end if;
 if t.owner_hash=p_owner then r:='owner'; else select role into r from public.bopok_invites where trip_id=p_id and token_hash=p_token and expires_at>now(); end if;
 if r is null then return jsonb_build_object('error','forbidden'); end if;
 if p_action in ('get','find') then return jsonb_build_object('id',t.id,'storageVersion',t.storage_version,'role',r,'trip',t.payload,'expiresAt',t.expires_at); end if;
 if p_action='update' then
  if r not in ('owner','editor') then return jsonb_build_object('error','forbidden'); end if;
  if t.payload->>'id' is not null and p_payload->>'id' is distinct from t.payload->>'id' then return jsonb_build_object('error','invalid'); end if;
  if p_expected is distinct from t.storage_version then return jsonb_build_object('error','conflict','storageVersion',t.storage_version); end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>524288 then return jsonb_build_object('error','invalid'); end if;
  -- Concurrent parent feedback is merged, never replaced by an older owner's draft.
  select coalesce(jsonb_agg(x order by x->>'at',x->>'id'),'[]'::jsonb) into f from (select x from (select distinct on (x->>'id') x from jsonb_array_elements(coalesce(t.payload->'feedback','[]')||coalesce(p_payload->'feedback','[]')) x order by x->>'id',x->>'at' desc) unique_feedback order by x->>'at' desc,x->>'id' desc limit 30) u;
  new_bytes:=octet_length(jsonb_set(p_payload,'{feedback}',f)::text);
  if new_bytes>524288 then return jsonb_build_object('error','invalid'); end if;
  select coalesce(sum(octet_length(payload::text)),0) into occupied_bytes from public.bopok_trips where id<>p_id;
  if occupied_bytes+new_bytes>262144000 then return jsonb_build_object('error','capacity'); end if;
  update public.bopok_trips set payload=jsonb_set(p_payload,'{feedback}',f),storage_version=storage_version+1,expires_at=now()+interval '30 days' where id=p_id returning * into t;
 elsif p_action='feedback' then
  if p_payload->>'text' is null or p_payload->>'text' not in ('좋아요','걷는 구간을 줄여 주세요','쉬는 시간을 늘려 주세요','식사를 바꾸고 싶어요') then return jsonb_build_object('error','invalid'); end if;
  f:=jsonb_build_object('id',gen_random_uuid(),'text',p_payload->>'text','at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  select coalesce(jsonb_agg(x order by n),'[]') into f from (select x,n from jsonb_array_elements(coalesce((select jsonb_agg(y order by y->>'at',m) from jsonb_array_elements(coalesce(t.payload->'feedback','[]')) with ordinality old(y,m)),'[]')||jsonb_build_array(f)) with ordinality u(x,n) order by n desc limit 30) v;
  new_bytes:=octet_length(jsonb_set(t.payload,'{feedback}',f)::text);
  if new_bytes>524288 then return jsonb_build_object('error','invalid'); end if;
  select coalesce(sum(octet_length(payload::text)),0) into occupied_bytes from public.bopok_trips where id<>p_id;
  if occupied_bytes+new_bytes>262144000 then return jsonb_build_object('error','capacity'); end if;
  update public.bopok_trips set payload=jsonb_set(payload,'{feedback}',f),storage_version=storage_version+1 where id=p_id returning * into t;
 elsif p_action='invite' then
  if r<>'owner' or p_token !~ '^[a-f0-9]{64}$' or p_role not in ('viewer','editor') then return jsonb_build_object('error','forbidden'); end if;
  if (select count(*) from public.bopok_invites where trip_id=p_id and expires_at>now())>=10 then return jsonb_build_object('error','limit'); end if;
  insert into public.bopok_invites(token_hash,trip_id,role) values(p_token,p_id,p_role);
  return jsonb_build_object('created',true,'expiresAt',now()+interval '7 days');
 elsif p_action='revoke' then
  if r<>'owner' then return jsonb_build_object('error','forbidden'); end if;
  delete from public.bopok_invites where trip_id=p_id; return jsonb_build_object('revoked',true);
 elsif p_action='delete' then
  if r<>'owner' then return jsonb_build_object('error','forbidden'); end if;
  delete from public.bopok_trips where id=p_id; return jsonb_build_object('deleted',true);
 else return jsonb_build_object('error','invalid'); end if;
 return jsonb_build_object('id',t.id,'storageVersion',t.storage_version,'role',r,'trip',t.payload);
end $$;

create or replace function public.bopok_reserve(p_subject text,p_tokens integer default 0,p_cost numeric default 0,p_minute_limit integer default 10,p_daily_requests integer default 500,p_daily_tokens bigint default 1000000,p_daily_cost numeric default 5,p_scope text default 'general') returns jsonb
language plpgsql security definer set search_path='' as $$
declare m text; d text; minute_row public.bopok_quotas; day_row public.bopok_quotas;
begin
 if p_scope not in ('general','ai','feedback','route','session','storage','recovery') or p_subject !~ '^[a-f0-9]{64}$' or p_tokens<0 or p_cost<0 then return jsonb_build_object('allowed',false); end if;
 perform pg_advisory_xact_lock(hashtext('bopok-global-quotas'));
 m:='minute:'||p_subject||':'||floor(extract(epoch from now())/60)::text;
 d:='daily:'||p_scope||':'||to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD');
 insert into public.bopok_quotas(bucket) values(m),(d) on conflict do nothing;
 select * into minute_row from public.bopok_quotas where bucket=m;
 select * into day_row from public.bopok_quotas where bucket=d;
 if minute_row.requests>=p_minute_limit or day_row.requests>=p_daily_requests or day_row.tokens+p_tokens>p_daily_tokens or day_row.cost+p_cost>p_daily_cost then return jsonb_build_object('allowed',false,'reason','quota'); end if;
 update public.bopok_quotas set requests=requests+1 where bucket=m;
 update public.bopok_quotas set requests=requests+1,tokens=tokens+p_tokens,cost=cost+p_cost where bucket=d;
 return jsonb_build_object('allowed',true,'reservedTokens',p_tokens,'reservedCostUsd',p_cost,'remainingRequests',p_daily_requests-day_row.requests-1);
end $$;


create table if not exists public.bopok_owners(owner_hash text primary key,recovery_hash text unique not null,expires_at timestamptz not null default now()+interval '365 days');
alter table public.bopok_owners enable row level security;
revoke all on public.bopok_owners from public;
create or replace function public.bopok_identity(p_action text,p_owner text default '',p_hash text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare found_owner text;
begin
 if p_action='set' then
  if p_owner !~ '^[a-f0-9]{64}$' or p_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','forbidden'); end if;
  insert into public.bopok_owners(owner_hash,recovery_hash) values(p_owner,p_hash) on conflict(owner_hash) do update set recovery_hash=excluded.recovery_hash,expires_at=now()+interval '365 days';
  return jsonb_build_object('ready',true);
 elsif p_action='recover' then
  select owner_hash into found_owner from public.bopok_owners where recovery_hash=p_hash and expires_at>now();
  if not found then return jsonb_build_object('error','forbidden'); end if;
  return jsonb_build_object('owner',found_owner);
 elsif p_action='touch' then
  update public.bopok_owners set expires_at=now()+interval '365 days' where owner_hash=p_owner;
  return jsonb_build_object('ready',true);
 end if;
 return jsonb_build_object('error','invalid');
end $$;
revoke all on function public.bopok_identity(text,text,text) from public;
grant execute on function public.bopok_identity(text,text,text) to service_role;

-- Bound public cache payloads too; expired rows are reclaimed on writes.
create or replace function public.bopok_cache(p_key text,p_value jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare occupied_bytes bigint;
begin
 if p_value is null then return (select value from public.bopok_public_cache where key=p_key and expires_at>now()); end if;
 if length(p_key)>200 or octet_length(p_value::text)>524288 then return jsonb_build_object('error','invalid'); end if;
 perform pg_advisory_xact_lock(hashtext('bopok-cache-storage'));
 delete from public.bopok_public_cache where expires_at<=now();
 if not exists(select 1 from public.bopok_public_cache where key=p_key) and (select count(*) from public.bopok_public_cache where key like 'catalog:%')>=2000 then return jsonb_build_object('error','capacity'); end if;
 select coalesce(sum(octet_length(value::text)),0) into occupied_bytes from public.bopok_public_cache where key<>p_key;
 if occupied_bytes+octet_length(p_value::text)>104857600 then return jsonb_build_object('error','capacity'); end if;
 insert into public.bopok_public_cache(key,value,expires_at) values(p_key,p_value,now()+interval '1 day') on conflict(key) do update set value=excluded.value,expires_at=excluded.expires_at;
 return p_value;
end $$;


-- 005_readiness_operations
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


-- 006_accounts_reviews
create or replace function public.bopok_claim(p_owner text,p_previous text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if p_owner !~ '^[a-f0-9]{64}$' or p_previous !~ '^[a-f0-9]{64}$' or p_owner=p_previous then return jsonb_build_object('error','invalid'); end if;
 perform pg_advisory_xact_lock(hashtext('claim:'||least(p_owner,p_previous)));
 update public.bopok_trips set owner_hash=p_owner where owner_hash=p_previous; get diagnostics n=row_count;
 delete from public.bopok_owners where owner_hash=p_previous;
 return jsonb_build_object('claimed',n);
end $$;
create table if not exists public.bopok_reviews(id uuid primary key default gen_random_uuid(),owner_hash text not null,place_id text not null,place_name text not null,payload jsonb not null,status text not null default 'pending' check(status in ('pending','approved','rejected')),reviewer_hash text,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 days');
alter table public.bopok_reviews enable row level security;
revoke all on public.bopok_reviews from public;
create or replace function public.bopok_review(p_action text,p_owner text,p_id uuid default null,p_payload jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.bopok_reviews; result jsonb;
begin
 if p_owner !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','invalid'); end if;
 if p_action='submit' then
  perform pg_advisory_xact_lock(hashtext('review-capacity'));
  if pg_column_size(p_payload)>50000 or length(p_payload->>'placeId')>100 or length(p_payload->>'placeName')>120 then return jsonb_build_object('error','invalid'); end if;
  if (select count(*) from public.bopok_reviews where expires_at>now())>=2000 or (select count(*) from public.bopok_reviews where owner_hash=p_owner and status='pending' and expires_at>now())>=20 then return jsonb_build_object('error','limit'); end if;
  insert into public.bopok_reviews(owner_hash,place_id,place_name,payload) values(p_owner,p_payload->>'placeId',p_payload->>'placeName',p_payload) returning * into row;
 elsif p_action in ('approve','reject') then
  select * into row from public.bopok_reviews where id=p_id and expires_at>now() for update;
  if not found then return jsonb_build_object('error','not_found'); end if;
  if row.owner_hash=p_owner then return jsonb_build_object('error','self_review'); end if;
  if row.status<>'pending' then return jsonb_build_object('error','conflict'); end if;
  update public.bopok_reviews set status=case when p_action='approve' then 'approved' else 'rejected' end,reviewer_hash=p_owner where id=p_id returning * into row;
 elsif p_action in ('mine','pending','approved') then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'placeId',place_id,'placeName',place_name,'payload',payload,'status',status,'createdAt',created_at)),'[]'::jsonb) into result from (select * from public.bopok_reviews where expires_at>now() and (case when p_action='mine' then owner_hash=p_owner when p_action='pending' then status='pending' and owner_hash<>p_owner else status='approved' end) order by created_at desc limit 100) t;
  return jsonb_build_object('reviews',result);
 else return jsonb_build_object('error','invalid'); end if;
 return jsonb_build_object('id',row.id,'placeId',row.place_id,'placeName',row.place_name,'payload',row.payload,'status',row.status);
end $$;
revoke all on function public.bopok_claim(text,text),public.bopok_review(text,text,uuid,jsonb) from public;
grant execute on function public.bopok_claim(text,text),public.bopok_review(text,text,uuid,jsonb) to service_role;
insert into public.bopok_schema_versions(version) values(6) on conflict do nothing;


-- 007_operations_final
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


-- 009_capacity
-- Adjustable storage limits retain hard bounds and distributed quota reservations.
create table if not exists public.bopok_limits(name text primary key,value bigint not null check(value>0));
alter table public.bopok_limits enable row level security;
revoke all on public.bopok_limits from public;
create or replace function public.bopok_limit(p_name text,p_default bigint,p_max bigint) returns bigint language sql stable security definer set search_path='' as $$
 select least(p_max,greatest(1,coalesce((select value from public.bopok_limits where name=p_name),p_default)));
$$;
revoke all on function public.bopok_limit(text,bigint,bigint) from public;
-- Upgrade the existing function without copying or losing its authorization/CAS/feedback behavior.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.bopok_trip(text,text,uuid,text,jsonb,integer,text)'::regprocedure);
 if position('>=2000' in definition)=0 or position('>524288' in definition)=0 then raise exception 'Unexpected trip function version';end if;
 definition:=replace(definition,'>=2000','>=public.bopok_limit(''trip_count'',2000,1000000)');
 definition:=replace(definition,'>=20','>=public.bopok_limit(''trips_per_owner'',20,1000)');
 definition:=replace(definition,'>524288','>8388608');
 definition:=replace(definition,'>262144000','>public.bopok_limit(''storage_bytes'',262144000,107374182400)');
 execute definition;
end $$;
create index if not exists bopok_trips_local_id on public.bopok_trips(owner_hash,(payload->>'id'));
create index if not exists bopok_reviews_status_expiry on public.bopok_reviews(status,expires_at);
insert into public.bopok_schema_versions(version) values(9) on conflict do nothing;


-- 010_final_readiness
create or replace function public.bopok_review_timestamp() returns trigger language plpgsql set search_path='' as $$
begin if new.status='approved' and old.status='pending' then new.approved_at=now();end if;return new;end $$;
drop trigger if exists bopok_review_timestamp on public.bopok_reviews;
create trigger bopok_review_timestamp before update on public.bopok_reviews for each row execute function public.bopok_review_timestamp();
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.bopok_review(text,text,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'''createdAt'',created_at','''createdAt'',created_at,''verifiedAt'',approved_at');
 definition:=replace(definition,'''status'',row.status)','''status'',row.status,''verifiedAt'',row.approved_at)');
 execute definition;
 definition:=pg_get_functiondef('public.bopok_health(integer)'::regprocedure);
 definition:=replace(definition,'''lastCleanupAt'',cleanup)', '''lastCleanupAt'',cleanup,''backupVerifiedAt'',(select backup_verified_at from public.bopok_operations where id=true))');
 definition:=replace(definition,'''schemaVersion'',installed','''contractVersion'',10,''schemaVersion'',installed');
 definition:=replace(definition,'installed>=p_required and identity_ready and quota_ready','installed>=p_required and identity_ready and quota_ready and (p_required<9 or pg_get_functiondef(''public.bopok_trip(text,text,uuid,text,jsonb,integer,text)''::regprocedure) like ''%8388608%'') and (p_required<6 or to_regprocedure(''public.bopok_claim(text,text)'') is not null)');
 definition:=replace(definition,'to_regclass(''public.bopok_reviews'') is not null','to_regclass(''public.bopok_reviews'') is not null and to_regprocedure(''public.bopok_review(text,text,uuid,jsonb)'') is not null');
 execute definition;
end $$;
insert into public.bopok_schema_versions(version) values(10) on conflict do nothing;
select public.bopok_maintenance();


-- 011_quota_scopes
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.bopok_reserve(text,integer,numeric,integer,integer,bigint,numeric,text)'::regprocedure);
 definition:=replace(definition,'''storage'',''recovery'')','''storage'',''recovery'',''auth'',''review'',''refresh'')');
 execute definition;
 definition:=pg_get_functiondef('public.bopok_health(integer)'::regprocedure);
 definition:=replace(definition,'''contractVersion'',10','''contractVersion'',11');
 execute definition;
end $$;
insert into public.bopok_schema_versions(version) values(11) on conflict do nothing;


-- 012_provider_readiness
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

NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT
 to_regclass('public.bopok_schema_versions') IS NOT NULL AS travel_tables_ready,
 to_regprocedure('public.bopok_reserve(text,integer,numeric,integer,integer,bigint,numeric,text)') IS NOT NULL AS ai_usage_function_ready,
 (SELECT max(version) FROM public.bopok_schema_versions) AS schema_version;

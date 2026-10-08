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

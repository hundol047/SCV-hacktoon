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

-- Server service-role RPC only. A random invitation token (stored hashed) grants access.
create table if not exists public.bopok_groups(token_hash text primary key, owner_hash text not null, places jsonb not null, created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 days');
create table if not exists public.bopok_group_votes(token_hash text references public.bopok_groups(token_hash) on delete cascade, voter_hash text not null, place_id text not null, name text not null, vote integer not null check(vote between -1 and 1), comment text not null default '',updated_at timestamptz not null default now(),primary key(token_hash,voter_hash,place_id));
alter table public.bopok_groups enable row level security;
alter table public.bopok_group_votes enable row level security;
revoke all on public.bopok_groups,public.bopok_group_votes from public,anon;
create or replace function public.bopok_group(p_action text,p_token text,p_voter text,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.bopok_groups; pid text; result jsonb;
begin
 if p_token !~ '^[a-f0-9]{64}$' or p_voter !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','invalid');end if;
 perform pg_advisory_xact_lock(hashtext(p_token));
 if p_action='create' then
  delete from public.bopok_groups where expires_at<=now();
  if (select count(*) from public.bopok_groups)>=5000 then return jsonb_build_object('error','capacity');end if;
  if jsonb_typeof(p_payload->'places') is distinct from 'array' or jsonb_array_length(p_payload->'places')>100 then return jsonb_build_object('error','invalid');end if;
  if (select count(*) from public.bopok_groups where owner_hash=p_voter and expires_at>now())>=20 then return jsonb_build_object('error','limit');end if;
  insert into public.bopok_groups(token_hash,owner_hash,places) values(p_token,p_voter,p_payload->'places') on conflict do nothing;
 end if;
 select * into g from public.bopok_groups where token_hash=p_token and expires_at>now();
 if not found then return jsonb_build_object('error','not_found');end if;
 if p_action='vote' then
  pid=p_payload->>'placeId';
  if not exists(select 1 from jsonb_array_elements(g.places) p where p->>'id'=pid) or length(p_payload->>'name') not between 1 and 40 or length(coalesce(p_payload->>'comment',''))>300 or coalesce(p_payload->>'vote','') not in ('-1','0','1') then return jsonb_build_object('error','invalid');end if;
  if not exists(select 1 from public.bopok_group_votes where token_hash=p_token and voter_hash=p_voter) and (select count(distinct voter_hash) from public.bopok_group_votes where token_hash=p_token)>=20 then return jsonb_build_object('error','limit');end if;
  insert into public.bopok_group_votes(token_hash,voter_hash,place_id,name,vote,comment) values(p_token,p_voter,pid,p_payload->>'name',(p_payload->>'vote')::integer,coalesce(p_payload->>'comment','')) on conflict(token_hash,voter_hash,place_id) do update set name=excluded.name,vote=excluded.vote,comment=excluded.comment,updated_at=now();
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('placeId',place_id,'name',name,'vote',vote,'comment',comment,'mine',voter_hash=p_voter) order by updated_at),'[]'::jsonb) into result from public.bopok_group_votes where token_hash=p_token;
 return jsonb_build_object('places',g.places,'votes',result);
end;$$;
revoke all on function public.bopok_group(text,text,text,jsonb) from public,anon;
grant execute on function public.bopok_group(text,text,text,jsonb) to service_role;

-- Invitation links are read/vote capabilities. Only the creating browser may publish.
create table if not exists public.bopok_live_plans(token_hash text primary key,owner_hash text not null,document jsonb not null,private_document jsonb not null,revision integer not null,proposal jsonb,private_proposal jsonb,proposal_id integer not null default 0,expires_at timestamptz not null default now()+interval '30 days',updated_at timestamptz not null default now());
create table if not exists public.bopok_live_votes(token_hash text references public.bopok_live_plans(token_hash) on delete cascade,voter_hash text not null,name text not null,approve boolean not null,primary key(token_hash,voter_hash));
alter table public.bopok_live_plans enable row level security;
alter table public.bopok_live_votes enable row level security;
revoke all on public.bopok_live_plans,public.bopok_live_votes from public,anon;
create or replace function public.bopok_live(p_action text,p_token text,p_owner text,p_expected integer default 0,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.bopok_live_plans; votes jsonb; needed integer;
begin
 if p_token !~ '^[a-f0-9]{64}$' or p_owner !~ '^[a-f0-9]{64}$' or octet_length(p_payload::text)>2000000 then return jsonb_build_object('error','invalid');end if;
 perform pg_advisory_xact_lock(hashtext(p_token));
 if p_action='create' then
  perform pg_advisory_xact_lock(hashtext('bopok-live-capacity'));
  delete from public.bopok_live_plans where expires_at<=now();
  if (select count(*) from public.bopok_live_plans)>=5000 or (select count(*) from public.bopok_live_plans where owner_hash=p_owner)>=20 then return jsonb_build_object('error','capacity');end if;
  if p_payload->'document' is null or p_payload->'private' is null then return jsonb_build_object('error','invalid');end if;
  insert into public.bopok_live_plans(token_hash,owner_hash,document,private_document,revision) values(p_token,p_owner,p_payload->'document',p_payload->'private',p_expected) on conflict do nothing;
 end if;
 select * into g from public.bopok_live_plans where token_hash=p_token and expires_at>now() for update;
 if not found then return jsonb_build_object('error','expired');end if;
 if p_action in ('publish','propose','confirm','cancel') then
  if g.owner_hash<>p_owner then return jsonb_build_object('error','forbidden');end if;
  if g.revision<>p_expected then return jsonb_build_object('error','conflict');end if;
 end if;
 if p_action in ('publish','propose') then
  if p_payload->'document' is null or p_payload->'private' is null or p_payload->'document'->>'id'<>g.document->>'id' then return jsonb_build_object('error','invalid');end if;
  if p_action='publish' then
   if (p_payload->'private'->>'revision')::integer<=g.revision then return jsonb_build_object('error','conflict');end if;
   update public.bopok_live_plans set document=p_payload->'document',private_document=p_payload->'private',revision=(p_payload->'private'->>'revision')::integer,proposal=null,private_proposal=null,updated_at=now() where token_hash=p_token;
  else
   if (p_payload->'private'->>'revision')::integer<>g.revision+1 then return jsonb_build_object('error','conflict');end if;
   update public.bopok_live_plans set proposal=p_payload->'document',private_proposal=p_payload->'private',proposal_id=proposal_id+1,updated_at=now() where token_hash=p_token;
  end if;
  delete from public.bopok_live_votes where token_hash=p_token;
  if p_action='propose' then insert into public.bopok_live_votes values(p_token,p_owner,'작성자',true);end if;
 end if;
 if p_action='vote' then
  if g.proposal is null or (p_payload->>'proposalId')::integer is distinct from g.proposal_id then return jsonb_build_object('error','stale_proposal');end if;
  if length(p_payload->>'name') not between 1 and 40 or jsonb_typeof(p_payload->'approve') is distinct from 'boolean' then return jsonb_build_object('error','invalid');end if;
  if not exists(select 1 from public.bopok_live_votes where token_hash=p_token and voter_hash=p_owner) and (select count(*) from public.bopok_live_votes where token_hash=p_token)>=least(20,(g.document->>'travelers')::integer) then return jsonb_build_object('error','participants');end if;
  insert into public.bopok_live_votes values(p_token,p_owner,p_payload->>'name',(p_payload->>'approve')::boolean) on conflict(token_hash,voter_hash) do update set name=excluded.name,approve=excluded.approve;
 end if;
 needed=floor((g.document->>'travelers')::integer/2.0)::integer+1;
 if p_action='confirm' then
  if g.proposal is null or (p_payload->>'proposalId')::integer is distinct from g.proposal_id then return jsonb_build_object('error','stale_proposal');end if;
  if (select count(*) from public.bopok_live_votes where token_hash=p_token and approve)<needed then return jsonb_build_object('error','votes_needed');end if;
  update public.bopok_live_plans set document=proposal,private_document=private_proposal,revision=(private_proposal->>'revision')::integer,proposal=null,private_proposal=null,updated_at=now() where token_hash=p_token;
 end if;
 if p_action='cancel' then update public.bopok_live_plans set proposal=null,private_proposal=null where token_hash=p_token;end if;
 select * into g from public.bopok_live_plans where token_hash=p_token;
 select coalesce(jsonb_agg(jsonb_build_object('name',name,'approve',approve,'mine',voter_hash=p_owner)),'[]'::jsonb) into votes from public.bopok_live_votes where token_hash=p_token;
 return jsonb_build_object('document',g.document,'revision',g.revision,'proposal',g.proposal,'proposalId',g.proposal_id,'votes',votes,'needed',needed,'owner',g.owner_hash=p_owner,'private',case when g.owner_hash=p_owner then g.private_document else null end,'updatedAt',g.updated_at,'expiresAt',g.expires_at);
end;$$;
revoke all on function public.bopok_live(text,text,text,integer,jsonb) from public,anon;
grant execute on function public.bopok_live(text,text,text,integer,jsonb) to service_role;

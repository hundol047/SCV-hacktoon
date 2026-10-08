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

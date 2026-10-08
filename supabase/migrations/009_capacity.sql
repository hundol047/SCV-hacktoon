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

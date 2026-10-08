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

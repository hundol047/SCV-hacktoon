do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.bopok_reserve(text,integer,numeric,integer,integer,bigint,numeric,text)'::regprocedure);
 definition:=replace(definition,'''storage'',''recovery'')','''storage'',''recovery'',''auth'',''review'',''refresh'')');
 execute definition;
 definition:=pg_get_functiondef('public.bopok_health(integer)'::regprocedure);
 definition:=replace(definition,'''contractVersion'',10','''contractVersion'',11');
 execute definition;
end $$;
insert into public.bopok_schema_versions(version) values(11) on conflict do nothing;

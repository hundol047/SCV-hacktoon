-- Supabase production retention job; run after 001. pg_cron is not included in the local WASM test database.
create extension if not exists pg_cron;
select cron.schedule('bopok-retention','0 18 * * *',$job$
delete from public.bopok_trips where expires_at<=now();
delete from public.bopok_invites where expires_at<=now();
delete from public.bopok_public_cache where expires_at<=now();
delete from public.bopok_quotas where bucket like 'minute:%' and split_part(bucket,':',3)::bigint<floor(extract(epoch from now()-interval '2 days')/60);
delete from public.bopok_quotas where bucket like 'daily:%' and split_part(bucket,':',3)::date<current_date-45;
$job$);

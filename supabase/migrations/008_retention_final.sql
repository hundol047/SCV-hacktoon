-- pg_cron must be preloaded by the database platform. A failed scheduler setup fails deployment readiness.
create extension if not exists pg_cron;
select cron.schedule('bopok-retention','0 * * * *','select public.bopok_maintenance();');

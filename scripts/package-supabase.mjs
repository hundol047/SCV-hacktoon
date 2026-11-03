import {readFile,writeFile} from 'node:fs/promises';
const files=['001_bopok','003_audit_fixes','005_readiness_operations','006_accounts_reviews','007_operations_final','009_capacity','010_final_readiness','011_quota_scopes','012_provider_readiness'];
const header=`-- Yeohaengit first installation only. Run the ENTIRE file in Supabase SQL Editor.
-- Stops on existing public.bopok_* relations/functions; never upgrades or overwrites them.
-- Includes core schema and AI quota RPC. Automatic retention scheduling is separate.
BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND left(c.relname,6)='bopok_')
 OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND left(p.proname,6)='bopok_')
 THEN RAISE EXCEPTION 'Existing bopok objects found. Installation stopped; inspect existing schema first.';
 END IF;
END $$;
`;
const parts=await Promise.all(files.map(async name=>'\n-- '+name+'\n'+await readFile('supabase/migrations/'+name+'.sql','utf8')));
await writeFile('downloads/yeohaengit-supabase-first-install.sql',header+parts.join('\n')+`
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT
 to_regclass('public.bopok_schema_versions') IS NOT NULL AS travel_tables_ready,
 to_regprocedure('public.bopok_reserve(text,integer,numeric,integer,integer,bigint,numeric,text)') IS NOT NULL AS ai_usage_function_ready,
 (SELECT max(version) FROM public.bopok_schema_versions) AS schema_version;
`);

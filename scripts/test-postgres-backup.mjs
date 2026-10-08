// Runs only against its own fresh PostgreSQL container; no production credentials are read.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {backup,restore} from './backup.mjs';
const container='bopok-backup-test-'+randomBytes(4).toString('hex'),restoreContainer=container+'-restore',directory=await mkdtemp(join(tmpdir(),'bopok-backup-test-')),password=randomBytes(24).toString('hex');
const environment={...process.env,POSTGRES_PASSWORD:password,PGPASSWORD:password,DOCKER_CONFIG:process.env.DOCKER_CONFIG??'/tmp/bopok-docker-config'};
function command(args,input){return new Promise((resolve,reject)=>{const child=spawn('docker',args,{env:environment,stdio:['pipe','pipe','pipe']}),chunks=[],errors=[];child.stdout.on('data',c=>chunks.push(c));child.stderr.on('data',c=>errors.push(c));child.on('error',reject);child.on('exit',code=>code===0?resolve(Buffer.concat(chunks).toString()):reject(Error('Isolated PostgreSQL command failed ('+args[0]+'): '+Buffer.concat(errors).toString().split(password).join('[redacted]').slice(0,1500))));child.stdin.end(input);});}
const sql=statement=>command(['exec','-i','--env','PGPASSWORD',container,'psql','-h','127.0.0.1','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1'],statement);
let started=false,restoreStarted=false;process.env.BOPok_ISOLATED_TEST='true';try{
 await command(['run','-d','--name',container,'--env','POSTGRES_PASSWORD',process.env.BOPok_PG_TEST_IMAGE??'postgres:17-bookworm',...(process.env.BOPok_TEST_CRON==='true'?['-c','shared_preload_libraries=pg_cron','-c','cron.database_name=postgres','-c','cron.use_background_workers=on']:[])]);started=true;
 for(let attempt=0;;attempt++){try{await sql('select 1;');break;}catch(error){if(attempt>=30)throw error;await new Promise(r=>setTimeout(r,500));}}
 await sql('create role service_role;create role anon;create role authenticated;');
 for(const file of ['001_bopok.sql','003_audit_fixes.sql','005_readiness_operations.sql','006_accounts_reviews.sql','007_operations_final.sql','009_capacity.sql','010_final_readiness.sql','011_quota_scopes.sql','012_provider_readiness.sql'])await sql(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 if(process.env.BOPok_TEST_CRON==='true'){await sql(await readFile(new URL('../supabase/migrations/008_retention_final.sql',import.meta.url),'utf8'));await sql("select cron.schedule('bopok-retention','1 second','select public.bopok_maintenance();');");for(let attempt=0;;attempt++){const health=JSON.parse((await sql('select public.bopok_health(12);')).trim());if(health.maintenance.lastSuccessAt){assert.equal(health.maintenance.scheduled,true);break;}if(attempt>=30)throw Error('Scheduled cleanup did not succeed.');await new Promise(r=>setTimeout(r,500));}}
 await sql("create schema auth;create table auth.users(id uuid primary key,email text,encrypted_password text);insert into auth.users values('00000000-0000-4000-8000-000000000001','isolated@test.invalid','synthetic-password-hash');");const owner='f'.repeat(64);await sql(`select public.bopok_trip('create','${owner}',null,'','{"id":"backup-fixture","basics":{"title":"복원 검증"}}'); select public.bopok_maintenance();`);
 const result=JSON.parse((await sql('select public.bopok_health(12);')).trim());assert.equal(result.ready,true);assert.equal(result.schemaVersion,12);
 process.env.BOPok_PG_CLIENT_CONTAINER=container;process.env.DOCKER_CONFIG=environment.DOCKER_CONFIG;
 const url='postgresql://postgres:'+password+'@127.0.0.1:5432/postgres',target=url,key=randomBytes(32).toString('hex'),file=join(directory,'database.enc');
 await backup(file,url,key);const encrypted=await readFile(file);assert.equal(encrypted.includes(Buffer.from('backup-fixture')),false);
 await command(['run','-d','--name',restoreContainer,'--env','POSTGRES_PASSWORD',process.env.BOPok_PG_TEST_IMAGE??'postgres:17-bookworm']);restoreStarted=true;
 const restoredSQL=statement=>command(['exec','-i','--env','PGPASSWORD',restoreContainer,'psql','-h','127.0.0.1','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1'],statement);
 for(let attempt=0;;attempt++){try{await restoredSQL('select 1;');break;}catch(error){if(attempt>=30)throw error;await new Promise(r=>setTimeout(r,500));}}
 assert.equal((await restoredSQL("select count(*) from pg_roles where rolname in ('service_role','anon','authenticated');")).trim(),'0');
 process.env.BOPok_PG_CLIENT_CONTAINER=restoreContainer;
 await restore(file,target,key);const restored=await restoredSQL("select payload->>'id' from public.bopok_trips;");assert.equal(restored.trim(),'backup-fixture');
 assert.equal((await restoredSQL("select count(*) from pg_roles where rolname in ('service_role','anon','authenticated') and not rolcanlogin;")).trim(),'3');
 const accounts=await restoredSQL("select id::text||':'||encrypted_password from auth.users;");assert.equal(accounts.trim(),'00000000-0000-4000-8000-000000000001:synthetic-password-hash');
 const policies=await restoredSQL("select relrowsecurity from pg_class where oid='public.bopok_trips'::regclass;");assert.equal(policies.trim(),'t');
 await assert.rejects(()=>restore(file,target,key),/empty database/);await assert.rejects(()=>restore(file,target,randomBytes(32).toString('hex')));
 encrypted[encrypted.length-1]^=1;await writeFile(join(directory,'tampered.enc'),encrypted);await assert.rejects(()=>restore(join(directory,'tampered.enc'),target,key));
 console.log(JSON.stringify({postgres:17,schema:12,authUsersPreserved:true,missingRolesRecreated:true,separateClusterRestore:true,cronExecuted:process.env.BOPok_TEST_CRON==='true',encryptedBackup:true,restore:true,rlsPreserved:true,nonemptyTargetRejected:true,tamperingRejected:true}));
}finally{delete process.env.BOPok_PG_CLIENT_CONTAINER;if(restoreStarted)await command(['rm','-f',restoreContainer]);if(started)await command(['rm','-f',container]);await rm(directory,{recursive:true,force:true});}

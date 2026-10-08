// Runs only against its own fresh PostgreSQL container; no production credentials are read.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {backup,restore} from './backup.mjs';
const container='bopok-backup-test-'+randomBytes(4).toString('hex'),directory=await mkdtemp(join(tmpdir(),'bopok-backup-test-')),password=randomBytes(24).toString('hex');
const environment={...process.env,POSTGRES_PASSWORD:password,PGPASSWORD:password,DOCKER_CONFIG:process.env.DOCKER_CONFIG??'/tmp/bopok-docker-config'};
function command(args,input){return new Promise((resolve,reject)=>{const child=spawn('docker',args,{env:environment,stdio:['pipe','pipe','pipe']}),chunks=[];child.stdout.on('data',c=>chunks.push(c));child.stderr.resume();child.on('error',reject);child.on('exit',code=>code===0?resolve(Buffer.concat(chunks).toString()):reject(Error('Isolated PostgreSQL command failed.')));child.stdin.end(input);});}
const sql=statement=>command(['exec','-i','--env','PGPASSWORD',container,'psql','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1'],statement);
let started=false;process.env.BOPok_ISOLATED_TEST='true';try{
 await command(['run','-d','--name',container,'--env','POSTGRES_PASSWORD',process.env.BOPok_PG_TEST_IMAGE??'postgres:17-bookworm',...(process.env.BOPok_TEST_CRON==='true'?['-c','shared_preload_libraries=pg_cron','-c','cron.database_name=postgres','-c','cron.use_background_workers=on']:[])]);started=true;
 for(let attempt=0;;attempt++){try{await sql('select 1;');break;}catch(error){if(attempt>=30)throw error;await new Promise(r=>setTimeout(r,500));}}
 await sql('create role service_role;create role anon;create role authenticated;');
 for(const file of ['001_bopok.sql','003_audit_fixes.sql','005_readiness_operations.sql','006_accounts_reviews.sql','007_operations_final.sql','009_capacity.sql','010_final_readiness.sql','011_quota_scopes.sql'])await sql(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 if(process.env.BOPok_TEST_CRON==='true'){await sql(await readFile(new URL('../supabase/migrations/008_retention_final.sql',import.meta.url),'utf8'));await sql("select cron.schedule('bopok-retention','1 second','select public.bopok_maintenance();');");for(let attempt=0;;attempt++){const health=JSON.parse((await sql('select public.bopok_health(11);')).trim());if(health.maintenance.lastSuccessAt){assert.equal(health.maintenance.scheduled,true);break;}if(attempt>=30)throw Error('Scheduled cleanup did not succeed.');await new Promise(r=>setTimeout(r,500));}}
 const owner='f'.repeat(64);await sql(`select public.bopok_trip('create','${owner}',null,'','{"id":"backup-fixture","basics":{"title":"복원 검증"}}'); select public.bopok_maintenance();`);
 const result=JSON.parse((await sql('select public.bopok_health(11);')).trim());assert.equal(result.ready,true);assert.equal(result.schemaVersion,11);
 await sql('create database bopok_restore;');process.env.BOPok_PG_CLIENT_CONTAINER=container;process.env.DOCKER_CONFIG=environment.DOCKER_CONFIG;
 const url='postgresql://postgres:'+password+'@127.0.0.1:5432/postgres',target=url.slice(0,url.lastIndexOf('/')+1)+'bopok_restore',key=randomBytes(32).toString('hex'),file=join(directory,'database.enc');
 await backup(file,url,key);const encrypted=await readFile(file);assert.equal(encrypted.includes(Buffer.from('backup-fixture')),false);
 await restore(file,target,key);const restored=await command(['exec','--env','PGPASSWORD',container,'psql','-U','postgres','-d','bopok_restore','-At','-c',"select payload->>'id' from public.bopok_trips;"]);assert.equal(restored.trim(),'backup-fixture');
 const policies=await command(['exec',container,'psql','-U','postgres','-d','bopok_restore','-At','-c',"select relrowsecurity from pg_class where oid='public.bopok_trips'::regclass;"]);assert.equal(policies.trim(),'t');
 await assert.rejects(()=>restore(file,target,key),/empty database/);await assert.rejects(()=>restore(file,target,randomBytes(32).toString('hex')));
 encrypted[encrypted.length-1]^=1;await writeFile(join(directory,'tampered.enc'),encrypted);await assert.rejects(()=>restore(join(directory,'tampered.enc'),target,key));
 console.log(JSON.stringify({postgres:17,schema:11,cronExecuted:process.env.BOPok_TEST_CRON==='true',encryptedBackup:true,restore:true,rlsPreserved:true,nonemptyTargetRejected:true,tamperingRejected:true}));
}finally{delete process.env.BOPok_PG_CLIENT_CONTAINER;if(started)await command(['rm','-f',container]);await rm(directory,{recursive:true,force:true});}

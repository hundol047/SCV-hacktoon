import {afterAll,afterEach,beforeAll,it,expect,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {database,rpc} from '../scripts/test-store.mjs';
import {inspectStorage,readiness} from '../src/server/readiness';
import * as store from '../src/server/store';
let db:any;beforeAll(async()=>{db=await database();},20000);afterAll(async()=>{await db.close();});afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
it('legacy SQL health cannot report application readiness when migrations are missing',async()=>{
 const legacy=new PGlite();try{await legacy.exec('create role service_role;create role anon;');await legacy.exec(await readFile('supabase/migrations/001_bopok.sql','utf8'));vi.stubEnv('BOPok_SESSION_SECRET','isolated-session-secret-at-least-32-characters');const state=await inspectStorage({call:(name,args)=>rpc(legacy,name,args)});expect(state.connected).toBe(true);expect(state.ready).toBe(false);expect(state.reason).toBe('migration_missing');}finally{await legacy.close();}
});
it('latest schema checks identity/quotas and a missing signing secret fails readiness',async()=>{
 const adapter={call:(name:string,args:Record<string,unknown>)=>rpc(db,name,args)};vi.stubEnv('BOPok_SESSION_SECRET','');expect((await inspectStorage(adapter)).ready).toBe(false);vi.stubEnv('BOPok_SESSION_SECRET','isolated-session-secret-at-least-32-characters');const state=await inspectStorage(adapter);expect(state.ready).toBe(true);expect(state.schemaVersion).toBe(12);expect(state.features?.identity).toBe(true);expect((await inspectStorage(adapter,13)).ready).toBe(false);
});
it('readiness gates requested services and aggregate metrics contain no user data',async()=>{
 vi.stubEnv('BOPok_SESSION_SECRET','isolated-session-secret-at-least-32-characters');vi.stubEnv('BOPok_APP_URL','https://example.org');vi.stubEnv('BOPok_REQUIRED_FEATURES','storage,auth,routing,ai,bot,maintenance');for(const k of ['BOPok_SUPABASE_ANON_KEY','BOPok_ROUTE_KEY','BOPok_AI_KEY','BOPok_TURNSTILE_SITE_KEY'])vi.stubEnv(k,'');vi.spyOn(store,'configuredRPC').mockReturnValue({call:(name,args)=>rpc(db,name,args)});const state=await readiness();expect(state.ready).toBe(false);expect(state.missing).toEqual(expect.arrayContaining(['auth_missing','routing_missing','ai_missing','bot_missing','maintenance_unscheduled']));
 await rpc(db,'bopok_metric',{p_event:'routing',p_code:'unavailable',p_value:100});const metrics=await rpc(db,'bopok_metric',{p_event:'report'});expect(metrics.metrics.find((m:any)=>m.event==='routing')).toMatchObject({event:'routing',code:'unavailable',count:1});expect((await rpc(db,'bopok_metric',{p_event:'personal-conditions'})).error).toBe('invalid');
});
it('retention removes expired trips and keys while preserving active trips and reporting completion',async()=>{
 const owner='7'.repeat(64);const old=await rpc(db,'bopok_trip',{p_action:'create',p_owner:owner,p_payload:{id:'expired'}}),current=await rpc(db,'bopok_trip',{p_action:'create',p_owner:owner,p_payload:{id:'active'}});await db.query("update public.bopok_trips set expires_at=now()-interval '1 day' where id=$1",[old.id]);await rpc(db,'bopok_identity',{p_action:'set',p_owner:owner,p_hash:'8'.repeat(64)});await db.query("update public.bopok_owners set expires_at=now()-interval '1 day'");const cleaned=await rpc(db,'bopok_maintenance',{});expect(cleaned.deletedTrips).toBe(1);expect((await rpc(db,'bopok_trip',{p_action:'get',p_owner:owner,p_id:current.id})).trip.id).toBe('active');expect((await rpc(db,'bopok_health',{})).maintenance.lastCleanupAt).toBeTruthy();
});

it('an old health contract with a high version row cannot hide an incomplete upgrade',async()=>{vi.stubEnv('BOPok_SESSION_SECRET','isolated-session-secret-at-least-32-characters');const state=await inspectStorage({call:async()=>({schemaVersion:10,requiredVersion:10,ready:true,features:{identity:true,quotas:true,accounts:true,reviews:true},maintenance:{scheduled:true,lastSuccessAt:null,lastFailureAt:null,lastCleanupAt:null}})});expect(state.ready).toBe(false);expect(state.reason).toBe('migration_missing');});

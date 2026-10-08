import {beforeAll,afterAll,it,expect} from 'vitest';
import {database,rpc} from '../scripts/test-store.mjs';
let db:any;const owner='a'.repeat(64),viewer='b'.repeat(64),editor='c'.repeat(64);
beforeAll(async()=>{db=await database();},20000);afterAll(async()=>{await db.close();});
const call=(action:string,extra:Record<string,unknown>={})=>rpc(db,'bopok_trip',{p_action:action,p_owner:owner,...extra});
it('SQL migration supports shared storage, capabilities, feedback and optimistic concurrency',async()=>{
 const created=await call('create',{p_payload:{basics:{title:'테스트'},feedback:[]}});const id=created.id;
 expect((await call('get',{p_id:id})).storageVersion).toBe(0);
 await call('invite',{p_id:id,p_token:viewer});await call('invite',{p_id:id,p_token:editor,p_role:'editor'});
 expect((await call('get',{p_id:id,p_owner:'',p_token:viewer})).role).toBe('viewer');
 expect((await call('update',{p_id:id,p_owner:'',p_token:viewer,p_expected:0,p_payload:{}})).error).toBe('forbidden');
 expect((await call('delete',{p_id:id,p_owner:'',p_token:editor})).error).toBe('forbidden');
 const feedback=await call('feedback',{p_id:id,p_owner:'',p_token:viewer,p_payload:{text:'좋아요'}});expect(feedback.trip.feedback).toHaveLength(1);
 expect((await call('update',{p_id:id,p_expected:0,p_payload:{feedback:[]}})).error).toBe('conflict');
 const saved=await call('update',{p_id:id,p_owner:'',p_token:editor,p_expected:1,p_payload:{feedback:[]}});expect(saved.trip.feedback).toHaveLength(1);
 expect((await call('feedback',{p_id:id,p_payload:{}})).error).toBe('invalid');
 await call('revoke',{p_id:id});expect((await call('get',{p_id:id,p_owner:'',p_token:viewer})).error).toBe('forbidden');
 await db.query("update public.bopok_trips set expires_at=now()-interval '1 second' where id=$1",[id]);expect((await call('get',{p_id:id})).error).toBe('not_found');
});
it('shared SQL quotas cannot be bypassed by multiple server clients',async()=>{
 const attempts=await Promise.all(Array.from({length:11},()=>rpc(db,'bopok_reserve',{p_subject:owner})));expect(attempts.filter(x=>x.allowed)).toHaveLength(10);
 expect((await rpc(db,'bopok_reserve',{p_subject:viewer,p_tokens:100,p_cost:2,p_daily_cost:1})).allowed).toBe(false);
});
it('provider throttle and cached results are shared',async()=>{expect((await rpc(db,'bopok_geo_guard',{p_provider:'nominatim'})).allowed).toBe(true);expect((await rpc(db,'bopok_geo_guard',{p_provider:'nominatim'})).allowed).toBe(false);await rpc(db,'bopok_cache',{p_key:'test',p_value:{ok:true}});expect(await rpc(db,'bopok_cache',{p_key:'test'})).toEqual({ok:true});});
it('anonymous SQL role cannot read private tables or invoke server RPC',async()=>{await db.exec('set role anon');try{await expect(db.query('select * from public.bopok_trips')).rejects.toThrow();await expect(db.query("select public.bopok_trip('health')")).rejects.toThrow();}finally{await db.exec('reset role');}});

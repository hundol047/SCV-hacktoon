import {beforeAll,afterAll,afterEach,it,expect,vi} from 'vitest';
import {createHmac} from 'node:crypto';
import {database,rpc} from '../scripts/test-store.mjs';
import {osmCatalog,OpenRouteProvider} from '../src/adapters/real-data';
import {defaultBasics,defaultConditions,demoConditions} from '../src/domain/schema';
import {generate} from '../src/domain/engine';
import {validateSchedule} from '../src/domain/validate';
import {demoCatalog} from '../src/data/catalog';
import {issueSession,verifySession,hash} from '../src/server/security';
import * as store from '../src/server/store';
import {POST as sessionPOST} from '../src/app/api/session/route';
import {POST as catalogPOST} from '../src/app/api/catalog/route';
let db:any;
beforeAll(async()=>{db=await database();},20000);afterAll(async()=>{await db.close();});afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
const owner='d'.repeat(64),call=(action:string,extra:Record<string,unknown>={})=>rpc(db,'bopok_trip',{p_action:action,p_owner:owner,...extra});
const real=()=>osmCatalog('일본 교토',{elements:Array.from({length:8},(_,i)=>({type:'node',id:i+1,lat:35+i/100,lon:135+i/100,tags:{name:i<4?`박물관 ${i}`:`식당 ${i}`,tourism:i<4?'museum':undefined,amenity:i>=4?'restaurant':undefined}})).map(e=>({...e,tags:Object.fromEntries(Object.entries(e.tags).filter(([,v])=>v))}))},new Date().toISOString());
it('a generated rest anchor stays fixed while a valid surrounding proposal is found',()=>{
 const b={...defaultBasics,days:1},c={...demoConditions,restInterval:240};const before=generate(c,b);expect(before.blocked).toBe(false);
 const rest=before.items.find(i=>i.kind==='rest')!,locked={...rest,locked:true};expect(rest.id).toBe('plan:1:0');
 const after=generate(c,b,before.items.map(i=>i.id===rest.id?locked:i),['쉬는 시간을 늘려 주세요']);
 expect(after.blocked).toBe(false);expect(after.items.find(i=>i.id===locked.id)).toEqual(locked);expect(new Set(after.items.map(i=>i.id)).size).toBe(after.items.length);
});
it('real drafts apply fewer visits, longer rest and a new meal without inventing facilities',()=>{
 const catalog=real(),b={...defaultBasics,mode:'real' as const,region:catalog.region,days:1},c={...defaultConditions,requiredExperiences:['문화·전시']};const initial=generate(c,b,[],[],catalog);
 const fewer=generate(c,b,initial.items,['걷는 구간을 줄여 주세요'],catalog),rests=generate(c,b,initial.items,['쉬는 시간을 늘려 주세요'],catalog),meals=generate(c,b,initial.items,['식사를 바꾸고 싶어요'],catalog);
 expect(fewer.items.filter(i=>i.kind==='visit').length).toBeLessThan(initial.items.filter(i=>i.kind==='visit').length);expect(fewer.preserved).toContain('문화·전시');
 expect(rests.items.filter(i=>i.kind==='rest').at(-1)!.end-rests.items.filter(i=>i.kind==='rest').at(-1)!.start).toBe(30);
 expect(meals.items.find(i=>i.kind==='meal')!.placeId).not.toBe(initial.items.find(i=>i.kind==='meal')!.placeId);
 expect(validateSchedule(rests.items,c,b,catalog).issues.some(i=>i.code==='seat'&&i.status==='unknown')).toBe(true);expect(catalog.places.every(p=>p.seat.value===null&&p.walkMin.value===null)).toBe(true);
});
it('two-day real drafts distribute candidates; absent meal alternatives explain the unchanged selection',()=>{
 const catalog=real(),b={...defaultBasics,mode:'real' as const,region:catalog.region};const result=generate(defaultConditions,b,[],[],catalog);
 const days=[1,2].map(day=>result.items.filter(i=>i.kind==='visit'&&i.day===day).map(i=>i.placeId));expect(days[0].some(id=>days[1].includes(id))).toBe(false);
 const only={...catalog,places:[catalog.places[0],catalog.places[4]]},initial=generate(defaultConditions,b,[],[],only),after=generate(defaultConditions,b,initial.items,['식사를 바꾸고 싶어요'],only);expect(after.reasons.join('')).toContain('다른 식당 후보가 없어');
});
it('known meal preferences affect selection and missing menu evidence remains unknown',()=>{
 const b={...defaultBasics,days:1},c={...demoConditions,foodLikes:['죽'],restInterval:240};const result=generate(c,b);expect(result.blocked).toBe(false);
 expect(demoCatalog.places.find(p=>p.id===result.items.find(i=>i.kind==='meal')!.placeId)!.foods.value).toContain('죽');
 const catalog=real(),rb={...b,mode:'real' as const,region:catalog.region};expect(validateSchedule(generate(c,rb,[],[],catalog).items,c,rb,catalog).issues.some(i=>i.code==='food-preference'&&i.status==='unknown')).toBe(true);
});
it('SQL retains the latest thirty feedback entries in chronological order',async()=>{
 const created=await call('create',{p_payload:{id:'feedback-audit',basics:{title:'의견'},feedback:[]}});const ids:string[]=[];let saved:any;
 for(let i=0;i<31;i++){saved=await call('feedback',{p_id:created.id,p_payload:{text:'좋아요'}});ids.push(saved.trip.feedback.at(-1).id);}
 expect(saved.trip.feedback.map((f:any)=>f.id)).toEqual(ids.slice(-30));expect(saved.trip.feedback.some((f:any)=>f.id===ids[0])).toBe(false);
});
it('SQL create is idempotent per owner and travel identity, and find remains owner-only',async()=>{
 const payload={id:'same-local-trip',basics:{title:'중복 방지'},feedback:[]};const a=await call('create',{p_payload:payload}),b=await call('create',{p_payload:payload});expect(b.id).toBe(a.id);
 expect((await call('find',{p_payload:{id:payload.id}})).id).toBe(a.id);expect((await call('find',{p_owner:'e'.repeat(64),p_payload:{id:payload.id}})).error).toBe('not_found');
});
it('renewed signed sessions preserve ownership beyond the initial thirty days; legacy sessions upgrade',async()=>{
 const secret='isolated-audit-session-secret-at-least-32-chars';vi.stubEnv('BOPok_SESSION_SECRET',secret);const start=Date.now(),old=issueSession(start,owner),day=86400000;
 expect(verifySession(old,start+31*day)).toBeNull();expect(verifySession(issueSession(start+29*day,verifySession(old,start+29*day)!),start+31*day)).toBe(owner);
 const legacyId='L'.repeat(43),body=`${legacyId}.${start}`,legacy=`${body}.${createHmac('sha256',secret).update(body).digest('base64url')}`;expect(verifySession(legacy,start)).toBe(hash(legacyId));expect(verifySession(old+'tampered',start)).toBeNull();
 vi.stubEnv('BOPok_APP_URL','http://localhost:3000');vi.spyOn(store,'configuredRPC').mockReturnValue({call:(name,args)=>rpc(db,name,args)});vi.spyOn(Date,'now').mockReturnValue(start+29*day);
 const response=await sessionPOST(new Request('http://localhost:3000/api/session',{method:'POST',headers:{Origin:'http://localhost:3000',Cookie:`bopok_session=${old}`}}));expect(response.status).toBe(200);const renewed=response.headers.get('set-cookie')!.split(';')[0].split('=')[1];expect(verifySession(renewed,start+31*day)).toBe(owner);
});
it('recovery keys restore the original owner, rotate securely, expire and stay private to server RPC',async()=>{
 const a='1'.repeat(64),b='2'.repeat(64);await rpc(db,'bopok_identity',{p_action:'set',p_owner:owner,p_hash:a});expect((await rpc(db,'bopok_identity',{p_action:'recover',p_hash:a})).owner).toBe(owner);
 await rpc(db,'bopok_identity',{p_action:'set',p_owner:owner,p_hash:b});expect((await rpc(db,'bopok_identity',{p_action:'recover',p_hash:a})).error).toBe('forbidden');
 await db.query("update public.bopok_owners set expires_at=now()-interval '1 second' where owner_hash=$1",[owner]);expect((await rpc(db,'bopok_identity',{p_action:'recover',p_hash:b})).error).toBe('forbidden');
 await db.exec('set role anon');try{await expect(db.query('select * from public.bopok_owners')).rejects.toThrow();await expect(db.query("select public.bopok_identity('recover')")).rejects.toThrow();}finally{await db.exec('reset role');}
});
it('global daily limits apply across distinct anonymous owners and storage capacity is shared',async()=>{
 const limits=[];for(const p_subject of ['3','4','5'].map(x=>x.repeat(64)))limits.push(await rpc(db,'bopok_reserve',{p_subject,p_scope:'storage',p_daily_requests:2}));expect(limits.map(x=>x.allowed)).toEqual([true,true,false]);
 const before=await db.query('select count(*)::int as count from public.bopok_trips');const count=before.rows[0].count;
 await db.query("insert into public.bopok_trips(owner_hash,payload) select 'capacity-fixture','{}'::jsonb from generate_series(1,$1)",[2000-count]);
 try{expect((await call('create',{p_owner:'6'.repeat(64),p_payload:{id:'over-capacity'}})).error).toBe('capacity');}finally{await db.query("delete from public.bopok_trips where owner_hash='capacity-fixture'");}
});
it('expired city cache routes through the retained server trip and keeps unknown taxi walking',async()=>{
 vi.stubEnv('BOPok_SESSION_SECRET','isolated-audit-session-secret-at-least-32-chars');vi.stubEnv('BOPok_APP_URL','http://localhost:3000');vi.stubEnv('BOPok_ROUTE_KEY','synthetic-route-key');vi.spyOn(store,'configuredRPC').mockReturnValue({call:(name,args)=>rpc(db,name,args)});
 const catalog=real();await call('create',{p_payload:{id:'route-retained',catalog}});const from=catalog.places[0],to=catalog.places[4];
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({routes:[{summary:{distance:1200,duration:300}}]}));
 const response=await catalogPOST(new Request('http://localhost:3000/api/catalog',{method:'POST',headers:{Origin:'http://localhost:3000',Cookie:`bopok_session=${issueSession(Date.now(),owner)}`,'Content-Type':'application/json'},body:JSON.stringify({region:catalog.region,fromId:from.id,toId:to.id,transport:'taxi',tripId:'route-retained'})}));
 expect(response.status).toBe(200);expect((await response.json()).walkMin.value).toBeNull();expect(String(fetcher.mock.calls[0][0])).toContain('api.openrouteservice.org');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('old route evidence requests a refresh even when the catalog was recently collected',async()=>{
 const catalog=real(),route=await new OpenRouteProvider('synthetic',async()=>Response.json({routes:[{summary:{distance:1000,duration:120}}]})).route(catalog.places[0],catalog.places[1],'walk');route.duration.collectedAt=new Date(Date.now()-2*86400000).toISOString();catalog.routes=[route];
 const b={...defaultBasics,mode:'real' as const,region:catalog.region,days:1};const items=[{id:'stale-move',day:1,start:570,end:600,kind:'move' as const,placeId:null,fromId:route.fromId,toId:route.toId,transport:'walk' as const,locked:false,mode:'real' as const}];
 expect(validateSchedule(items,defaultConditions,b,catalog).issues.some(i=>i.code==='stale-route')).toBe(true);
});
it('facility records preserve source/date, reject future or unsafe sources and remain user evidence',async()=>{
 const {recordVenue}=await import('../src/domain/venue-facts');const catalog=real(),place=catalog.places[0],record={source:'https://example.org/venue-access',at:new Date(Date.now()-1000).toISOString(),walkMin:10,walkM:100,stairs:false,seat:true,cost:null,foods:null};const updated=recordVenue(place,record);
 expect(updated.seat.checked).toBe('user');expect(updated.cost.value).toBeNull();expect(()=>recordVenue(place,{...record,source:'javascript:alert(1)'})).toThrow();expect(()=>recordVenue(place,{...record,at:new Date(Date.now()+86400000).toISOString()})).toThrow();
 const b={...defaultBasics,days:1,mode:'real' as const,region:catalog.region};catalog.places[0]=updated;const result=generate(defaultConditions,b,[],[],catalog);expect(validateSchedule(result.items,defaultConditions,b,catalog).issues.some(i=>i.code==='user-evidence')).toBe(true);
});
it('HTTP POST with an empty body stream can issue a session; refresh alone never mints an owner',async()=>{
 vi.stubEnv('BOPok_SESSION_SECRET','isolated-audit-session-secret-at-least-32-chars');vi.spyOn(store,'configuredRPC').mockReturnValue({call:(name,args)=>rpc(db,name,args)});
 const headers={Origin:'http://localhost:3000','Content-Type':'application/json'};
 const empty=await sessionPOST(new Request('http://localhost:3000/api/session',{method:'POST',headers,body:''}));expect(empty.status).toBe(200);expect(empty.headers.get('set-cookie')).toContain('bopok_session=v2.');
 const refresh=await sessionPOST(new Request('http://localhost:3000/api/session',{method:'POST',headers,body:JSON.stringify({action:'refresh'})}));expect(refresh.status).toBe(200);expect(refresh.headers.get('set-cookie')).toBeNull();
});
it('shared catalog cache bounds entries, reclaims expired rows and preserves trip identity on updates',async()=>{
 await db.query("insert into public.bopok_public_cache(key,value,expires_at) select 'catalog:capacity-'||n,'{}'::jsonb,now()+interval '1 day' from generate_series(1,2000) n");
 try{expect((await rpc(db,'bopok_cache',{p_key:'catalog:new-capacity',p_value:{ok:true}})).error).toBe('capacity');await db.query("update public.bopok_public_cache set expires_at=now()-interval '1 second' where key='catalog:capacity-1'");expect(await rpc(db,'bopok_cache',{p_key:'catalog:new-capacity',p_value:{ok:true}})).toEqual({ok:true});}finally{await db.query("delete from public.bopok_public_cache where key like 'catalog:capacity-%' or key='catalog:new-capacity'");}
 const created=await call('create',{p_payload:{id:'stable-identity',feedback:[]}});expect((await call('update',{p_id:created.id,p_expected:0,p_payload:{id:'changed-identity',feedback:[]}})).error).toBe('invalid');
});

import {afterEach,expect,it,vi} from 'vitest';
import {defaultBasics,defaultConditions,tripSchema,type Trip,type Item} from '../src/domain/schema';
import {osmCatalog,OpenRouteProvider} from '../src/adapters/real-data';
import {catalogSchema} from '../src/data/catalog';
import {importTrip,exportTrip,loadLibrary,loadTrip,saveTrip,LIBRARY_KEY,STORAGE_KEY} from '../src/adapters/storage';
import {refreshCatalog} from '../src/domain/catalog-refresh';
import {convertMoney} from '../src/domain/world';
import {validateSchedule} from '../src/domain/validate';
import {undo} from '../src/domain/engine';
import {GET as catalogGET,POST as catalogPOST} from '../src/app/api/catalog/route';
import {issueSession} from '../src/server/security';
import * as store from '../src/server/store';
import {appURL} from '../src/server/config';
import {sameOrigin} from '../src/server/security';
import {roleOf} from '../src/server/account';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
const visit=(id:string,placeId:string,other:Partial<Item>={}):Item=>({id,placeId,day:1,start:540,end:570,kind:'visit',fromId:null,toId:null,transport:null,locked:false,mode:'real',...other});
const catalog=()=>{const c=osmCatalog('서울',{elements:[1,2,3].map(id=>({type:'node',id,lat:37.5+id/100,lon:127,tags:{name:'장소 '+id,leisure:'park'}}))},new Date().toISOString());c.places=c.places.map(p=>({...p,region:'서울'}));return c;};
function trip(c=catalog()):Trip{return {version:1,id:'integrity-fixture',revision:0,basics:{...defaultBasics,days:1,mode:'real',region:c.region},conditions:defaultConditions,items:[visit('current',c.places[0].id)],history:[],feedback:[],catalog:c};}

it('a supported file above the old 512 KB limit round trips history and feedback',()=>{
 const original=trip();original.history=Array.from({length:5},()=>Array.from({length:1000},(_,i)=>visit('history-'+i,original.catalog!.places[0].id)));original.feedback=[{id:'feedback-1',text:'좋아요',at:new Date().toISOString()}];
 const text=exportTrip(original);expect(Buffer.byteLength(text)).toBeGreaterThan(524288);expect(importTrip(text)).toEqual(original);expect(()=>importTrip(' '.repeat(8388609))).toThrow('8 MiB');
 expect(tripSchema.safeParse({...original,id:''}).success).toBe(false);
});
it('one corrupt library entry does not hide or overwrite the other trips',()=>{
 const a=trip(),b={...a,id:'second-valid'},values=new Map([[LIBRARY_KEY,JSON.stringify({version:1,trips:[a,{version:99},b]})]]),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
 expect(loadLibrary(storage).map(t=>t.id)).toEqual([a.id,b.id]);expect(saveTrip(storage,{...a,revision:1})).toBeNull();expect(loadLibrary(storage).map(t=>t.id)).toEqual([a.id,b.id]);
});
it('a library quota failure reports that the current trip was saved and preserves the old library',()=>{
 const original=trip(),values=new Map([[LIBRARY_KEY,JSON.stringify({version:1,trips:[original]})]]),old=values.get(LIBRARY_KEY),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(key===LIBRARY_KEY)throw Error('quota');values.set(key,value);}};
 expect(saveTrip(storage,{...original,revision:1})).toContain('현재 여행은 저장');expect(loadTrip(storage).trip?.revision).toBe(1);expect(values.get(LIBRARY_KEY)).toBe(old);expect(values.has(STORAGE_KEY)).toBe(true);
});
it('place refresh preserves undo-only places and drops routes whose endpoint coordinates changed',async()=>{
 const original=trip(),previous=original.catalog!,historical=previous.places[1];original.history=[[visit('old',historical.id)]];
 previous.routes=[await new OpenRouteProvider('synthetic',async()=>Response.json({routes:[{summary:{distance:1000,duration:300}}]})).route(previous.places[0],historical,'walk')];
 const fresh={...previous,places:[{...previous.places[0],latitude:38}],routes:[]},merged=refreshCatalog(original,fresh,'서울'),restored=undo({...original,catalog:merged});
 expect(merged.places.find(p=>p.id===historical.id)).toEqual(historical);expect(merged.routes).toEqual([]);expect(validateSchedule(restored.items,restored.conditions,restored.basics,merged).issues.some(i=>i.code==='place')).toBe(false);expect(previous.routes).toHaveLength(1);
});
it('a route identity cannot point to facts for different endpoints or omit a transit instant',async()=>{
 const c=catalog(),route=await new OpenRouteProvider('synthetic',async()=>Response.json({routes:[{summary:{distance:1000,duration:300}}]})).route(c.places[0],c.places[1],'walk');
 expect(catalogSchema.safeParse({...c,routes:[{...route,fromId:c.places[2].id}]}).success).toBe(false);expect(catalogSchema.safeParse({...c,routes:[{...route,transport:'transit',id:`r:${route.fromId}:${route.toId}:transit:undefined`}]}).success).toBe(false);
});
it('future FX and place timestamps do not count as fresh evidence',()=>{
 const original=trip(),c=original.catalog!,future=new Date(Date.now()+86400000).toISOString();c.fx={base:'EUR',at:future,rates:{KRW:1500},source:'https://example.org/fx'};expect(convertMoney(10,'EUR','KRW',c)).toBeNull();c.collectedAt=future;
 expect(validateSchedule(original.items,original.conditions,original.basics,c).issues.some(i=>i.code==='stale-data')).toBe(true);
});
it('known absent seats are violations and wrong departure places are checked even without route data',()=>{
 const original=trip(),c=original.catalog!;c.places[0].seat.value=false;
 const rest=visit('rest',c.places[0].id,{kind:'rest'});expect(validateSchedule([rest],defaultConditions,original.basics,c).issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'seat',status:'violation'})]));
 const move=visit('move','',{kind:'move',placeId:null,fromId:c.places[2].id,toId:c.places[1].id,transport:'taxi',start:580,end:600});
 const report=validateSchedule([...original.items,move,visit('arrival',c.places[1].id,{start:610,end:640})],defaultConditions,original.basics,c);expect(report.issues.some(i=>i.code==='route-origin')).toBe(true);expect(report.issues.some(i=>i.code==='missing-transfer'&&i.itemIds.includes('arrival'))).toBe(false);
});
it('invalid catalog input is a client error and does not invoke a provider',async()=>{
 vi.stubEnv('BOPok_APP_URL','http://localhost:3000');vi.stubEnv('BOPok_REQUIRE_AUTH','false');vi.stubEnv('BOPok_SESSION_SECRET','synthetic-input-session-secret-at-least-32-characters');const call=vi.fn(async()=>null);vi.spyOn(store,'configuredRPC').mockReturnValue({call});
 expect((await catalogGET(new Request('http://localhost:3000/api/catalog?region=Seoul&radius=999'))).status).toBe(400);
 const headers={Origin:'http://localhost:3000',Cookie:'bopok_session='+issueSession(),'Content-Type':'application/json'};
 expect((await catalogPOST(new Request('http://localhost:3000/api/catalog',{method:'POST',headers,body:'{'}))).status).toBe(400);
 expect((await catalogPOST(new Request('http://localhost:3000/api/catalog',{method:'POST',headers,body:' '.repeat(10001)}))).status).toBe(413);expect(call).not.toHaveBeenCalled();
});
it('invalid application URLs do not crash origin checks or claim that a public origin is configured',()=>{
 for(const value of ['not-a-url','https://user:password@example.org','http://example.org','https://example.org/path','https://example.org?secret=value']){vi.stubEnv('BOPok_APP_URL',value);expect(appURL()).toBeUndefined();expect(()=>sameOrigin(new Request('http://localhost:3000',{headers:{Origin:'http://localhost:3000'}}))).not.toThrow();}
 vi.stubEnv('BOPok_APP_URL','https://example.org/');expect(appURL()).toBe('https://example.org');
});
it('valid UUID allowlists assign the same role regardless of letter case',()=>{const account={id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',email:'isolated@test.invalid',exp:Math.floor(Date.now()/1000)+3600};vi.stubEnv('BOPok_REVIEWER_IDS',' '+account.id.toUpperCase()+' ');expect(roleOf(account,'reviewer')).toBe(true);expect(roleOf(null,'reviewer')).toBe(false);expect(roleOf({...account,id:'aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff'},'reviewer')).toBe(false);});

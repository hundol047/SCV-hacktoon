import {expect,it,vi} from 'vitest';
import {osmAccessibility,barrierFreeFacts,accessLabels} from '../src/domain/accessibility';
import {osmCatalog} from '../src/adapters/real-data';
import {defaultBasics,defaultConditions,basicsSchema} from '../src/domain/schema';
import {confirmedFacilities} from '../src/domain/venue-details';
import {rankVehiclePlaces} from '../src/domain/vehicle-recommendations';
import {regionalCourse} from '../src/domain/regional-course';
import {createAccessibilityEnricher} from '../src/server/accessibility';
import {recordVenue} from '../src/domain/venue-facts';
import {validateSchedule} from '../src/domain/validate';
const at=new Date().toISOString();
const catalog=()=>osmCatalog('서울',{elements:[1,2,3,4].map(id=>({type:'node',id,lat:37.5+id/1000,lon:127,tags:{name:'장소'+id,...(id<=2?{tourism:'museum'}:{amenity:'restaurant'}),wheelchair:id===4?'no':'yes'}}))},at);
const b=basicsSchema.parse({...defaultBasics,days:1,region:'서울',mode:'real',transport:'driving',travelHours:{start:540,end:1140},requiredFacilities:['wheelchair']});
it('OSM ramp and rental never imply wheelchair access, stairs or gradient',()=>{
 const f=osmAccessibility({ramp:'yes',wheelchair:'limited',incline:'up'},'x','https://example.org',at);
 expect(f?.ramp?.value).toBe(true);expect(f?.wheelchair).toBeUndefined();expect(f?.stepFree).toBeUndefined();expect(f?.gentleSlope).toBeUndefined();
 expect(osmAccessibility({incline:'-9%'},'x','https://example.org',at)?.gentleSlope?.value).toBe(false);
});
it('barrier free facts require explicit unqualified access statements',()=>{
 expect(barrierFreeFacts({wheelchair:'대여가능',exit:'경사로 있음'},'x',at)?.wheelchair).toBeUndefined();
 const f=barrierFreeFacts({exit:'경사로 설치, 문턱 없음, 휠체어 진입 가능',route:'진입로 완만',restroom:'장애인 화장실 있음'},'x',at);
 expect(f?.wheelchair?.value).toBe(true);expect(f?.ramp?.value).toBe(true);expect(f?.gentleSlope?.value).toBe(true);
 expect(barrierFreeFacts({exit:'휠체어 진입 가능하나 일부 구간 도움 필요'},'x',at)?.wheelchair).toBeUndefined();
 expect(barrierFreeFacts({exit:'휠체어 진입 불가'},'x',at)?.wheelchair?.value).toBe(false);
});
it('unknown, negative and stale records are excluded and stale badges hidden',()=>{
 const c=catalog(),p=c.places[0];
 const old={...p,id:'old',facilities:{wheelchair:{...p.facilities!.wheelchair!,collectedAt:'2020-01-01T00:00:00Z'}}};
 expect(rankVehiclePlaces([...c.places,old,{...p,id:'unknown',facilities:{}}],b,defaultConditions).map(r=>r.place.id)).toEqual(expect.not.arrayContaining(['old','unknown','osm:node:4']));
 expect(accessLabels(old)).toEqual([]);expect(confirmedFacilities(p,['wheelchair','ramp'])).toBe(false);
});
it('AI selection and automatic dinner respect requirements; invalid selected IDs rejected',()=>{
 const c=catalog();const result=regionalCourse(b,defaultConditions,c,1,{candidateIds:['osm:node:1','osm:node:2']});
 expect(result.places.some(p=>p.id==='osm:node:4')).toBe(false);
 expect(()=>regionalCourse(b,defaultConditions,c,1,{candidateIds:['osm:node:4']})).toThrow();
});
it('manual evidence survives schema and unsupported schedule cannot pass validation',()=>{
 const c=catalog(),p=recordVenue(c.places[0],{source:'https://example.org/venue',at,walkMin:null,walkM:null,stairs:null,seat:null,cost:null,foods:null,facilities:{ramp:true,wheelchair:true,gentleSlope:false}});
 expect(confirmedFacilities(p,['ramp','wheelchair'])).toBe(true);expect(confirmedFacilities(p,['gentleSlope'])).toBe(false);
 const rows=[{id:'v',kind:'visit' as const,day:1,start:540,end:600,placeId:c.places[0].id,fromId:null,toId:null,transport:null,locked:false,mode:'real' as const}];
 const report=validateSchedule(rows,defaultConditions,{...b,requiredFacilities:['ramp']},c);
 expect(report.issues).toContainEqual(expect.objectContaining({code:'facility-required',status:'violation'}));
});
it('provider enrichment uses matching content IDs, caches results and keeps keys out of facts',async()=>{
 const c=catalog();c.places=c.places.slice(0,1).map(p=>({...p,id:'tourapi:123',facilities:{}}));
 const fetcher=vi.fn(async()=>Response.json({response:{header:{resultCode:'0000'},body:{items:{item:{contentid:'123',exit:'휠체어 진입 가능, 경사로 있음'}}}}}));
 const enrich=createAccessibilityEnricher(fetcher as typeof fetch);
 const result=await enrich(c,'test-private-key');expect(result.places[0].facilities?.wheelchair?.value).toBe(true);expect(JSON.stringify(result)).not.toContain('test-private-key');
 await enrich(c,'test-private-key');expect(fetcher).toHaveBeenCalledTimes(1);expect(c.places[0].facilities).toEqual({});
});
it('provider failure or wrong content ID never creates accessibility evidence',async()=>{
 const c=catalog();c.places=c.places.slice(0,1).map(p=>({...p,id:'tourapi:123',facilities:{}}));
 for(const response of [new Response('upstream error',{status:502}),Response.json({response:{header:{resultCode:'00'},body:{items:{item:{contentid:'999',exit:'휠체어 진입 가능'}}}}})]){
  const enrich=createAccessibilityEnricher((async()=>response) as typeof fetch);
  expect((await enrich(c,'key')).places[0].facilities).toEqual({});
 }
});
it('reads explicit grammatical facility statements without inferring access from rental',()=>{
 const facts=barrierFreeFacts({exit:'문턱이 없음, 경사로가 설치되어 있음, 휠체어 진입 가능',restroom:'장애인 전용 화장실이 있음',elevator:'있음'},'venue',at);
 expect(facts?.stepFree?.value).toBe(true);expect(facts?.ramp?.value).toBe(true);expect(facts?.accessibleToilet?.value).toBe(true);expect(facts?.elevator?.value).toBe(true);
 expect(barrierFreeFacts({exit:'문턱이 있음, 경사로가 없음',elevator:'없음'},'venue',at)?.stepFree?.value).toBe(false);
 expect(barrierFreeFacts({wheelchair:'대여가능',elevator:'일부 구간만 이용 가능'},'venue',at)?.wheelchair).toBeUndefined();
});
it('enriches places beyond the original forty-place cutoff',async()=>{
 const c=catalog();c.places=Array.from({length:65},(_,i)=>({...c.places[0],id:'tourapi:'+(i+1),facilities:{}}));
 const fetcher=vi.fn(async(input:unknown)=>{const id=new URL(String(input)).searchParams.get('contentId');return Response.json({response:{header:{resultCode:'0000'},body:{items:{item:{contentid:id,exit:'휠체어 진입 가능'}}}}});});
 const result=await createAccessibilityEnricher(fetcher)(c,'key');expect(result.places[64].facilities?.wheelchair?.value).toBe(true);expect(fetcher).toHaveBeenCalledTimes(65);
});

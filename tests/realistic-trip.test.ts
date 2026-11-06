import {it,expect,vi} from 'vitest';
import {osmCatalog} from '../src/adapters/real-data';
import {defaultBasics,defaultConditions,type Trip} from '../src/domain/schema';
import {optimizeTaxiOrder} from '../src/domain/taxi-plan';
import {prepareTrip} from '../src/server/prepare-trip';
import {simpleOpening} from '../src/server/opening-enrichment';
import {visitDuration} from '../src/domain/visit-duration';
import {replanTrip} from '../src/server/replan-trip';
const catalog=osmCatalog('강릉',{elements:Array.from({length:5},(_,i)=>({type:'node',id:i+1,lat:37.75+i/10000,lon:128.9,tags:{name:i===0?'박물관':'공원'+i,tourism:'museum',indoor:'yes'}}))},new Date().toISOString());
const plan=optimizeTaxiOrder(catalog.places,catalog.places.slice(0,3).map(p=>p.id),catalog.places[0].id,2,null,null,undefined,{day:1});if('error'in plan)throw Error(plan.error);
const basics={...defaultBasics,mode:'real' as const,region:'강릉',days:1,transport:'taxi' as const,travelHours:{start:540,end:1110},coursePlans:[plan.plan],taxiPlan:plan.plan};
const fetcher=vi.fn(async(url:any)=>{const u=String(url);if(u.includes('/table/')){const points=u.split('/driving/')[1].split('?')[0].split(';').map(p=>p.split(',').map(Number));return Response.json({code:'Ok',sources:points.map(location=>({location})),destinations:points.map(location=>({location})),durations:points.map((_,i)=>points.map((_,j)=>i===j?0:1800)),distances:points.map((_,i)=>points.map((_,j)=>i===j?0:12000))});}return Response.json({elements:[]});});
it('uses queried road times, venue duration, and home departure/return bounds',async()=>{
 const trip=await prepareTrip({...basics,startMode:'home',returnBy:1140,departureCoordinates:{latitude:37.7,longitude:128.9}},defaultConditions,catalog,fetcher as typeof fetch);
 expect(trip.items[0].start).toBeGreaterThanOrEqual(570);expect(trip.items.filter(i=>i.kind==='move').every(i=>i.end-i.start===30)).toBe(true);expect(trip.items.find(i=>i.kind==='visit')!.end-trip.items[0].start).toBe(visitDuration(catalog.places[0]));expect(trip.basics.commutes?.find(c=>c.kind==='homebound')!.arrive).toBeLessThanOrEqual(1140);expect(trip.items.at(-1)!.end).toBeLessThan(1110);
});
it('fails rather than inventing 20-minute routes when provider is unavailable',async()=>{await expect(prepareTrip(basics,defaultConditions,catalog,async()=>new Response('',{status:503}))).rejects.toThrow('도로');});
it('conservative opening parser skips ambiguous and split hours',()=>{expect(simpleOpening('09:00~18:00 · 휴무: 매주 월요일')?.closedWeekdays).toEqual([1]);expect(simpleOpening('09:00~12:00 14:00~18:00')).toBeNull();expect(simpleOpening('동절기 09:00~16:00')).toBeNull();});
it('replanning keeps completed items and other days; excludes negatively voted places',async()=>{
 const trip=await prepareTrip(basics,defaultConditions,catalog,fetcher as typeof fetch);const cutoff=trip.items[0].end;
 const revised=await replanTrip(trip,1,cutoff,'rain',{[catalog.places[1].id]:-2},fetcher as typeof fetch);
 expect(revised.items.find(i=>i.id===trip.items[0].id)).toEqual(trip.items[0]);expect(revised.items.filter(i=>i.start>=cutoff&&i.kind==='visit').some(i=>i.placeId===catalog.places[1].id)).toBe(false);expect(revised.items.at(-1)!.end).toBeLessThanOrEqual(basics.travelHours.end);
});
it('excludes a venue that is closed at the planned visit time',async()=>{
 const date=basics.date;const first=catalog.places[0];const copy={...catalog,places:catalog.places.map(p=>p.id===first.id?{...p,opening:{value:{open:60,close:120,closedWeekdays:[],closedDates:[],reservationRequired:false},nature:'real' as const,checked:'source' as const,evidenceId:'opening',source:'https://example.com/hours',collectedAt:new Date().toISOString()}}:p)};
 const trip=await prepareTrip(basics,defaultConditions,copy,fetcher as typeof fetch);expect(trip.items.some(i=>i.kind==='visit'&&i.placeId===first.id)).toBe(false);
});
it('rejects weekday-specific opening text instead of treating it as daily',()=>{expect(simpleOpening('Mo-Fr 09:00-18:00')).toBeNull();expect(simpleOpening('월요일 09:00~18:00')).toBeNull();});
it('an explicit empty completed list does not pretend a delayed traveler visited earlier stops',async()=>{
 const trip=await prepareTrip(basics,defaultConditions,catalog,fetcher as typeof fetch);const revised=await replanTrip(trip,1,780,'unknown',{},fetcher as typeof fetch,[]);expect(revised.items.every(i=>i.start>=780)).toBe(true);expect(revised.items.some(i=>i.id===trip.items[0].id)).toBe(false);
});
it('explicitly completed stops stay locked and in the saved day plan',async()=>{
 const trip=await prepareTrip(basics,defaultConditions,catalog,fetcher as typeof fetch);const first=catalog.places[0].id;const cutoff=Math.max(...trip.items.filter(i=>i.placeId===first).map(i=>i.end));const revised=await replanTrip(trip,1,cutoff,'unknown',{},fetcher as typeof fetch,[first]);expect(revised.items.find(i=>i.id===trip.items[0].id)?.locked).toBe(true);expect(revised.basics.coursePlans?.[0].orderedPlaceIds).toContain(first);
});

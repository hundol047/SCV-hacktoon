import {it,expect} from 'vitest';
import {osmCatalog} from '../src/adapters/real-data';
import {defaultBasics,defaultConditions,type Trip} from '../src/domain/schema';
import {validateBatch} from '../src/domain/course-batch';
import {dailyCourseOptions} from '../src/domain/course-options';
import {savePlan} from '../src/domain/course-plans';
import {prepareTrip} from '../src/server/prepare-trip';
const catalog=osmCatalog('강릉',{elements:Array.from({length:50},(_,i)=>({type:'node',id:i+1,lat:37.75+i*.0001,lon:128.9,tags:i<40?{name:i%3===0?'수목원 '+i:i%3===1?'박물관 '+i:'해변 '+i,tourism:'attraction'}:{name:'초당순두부 식당 '+i,amenity:'restaurant'}}))},new Date().toISOString(),200);
const conditions={...defaultConditions,restMin:20};
const fetcher:typeof fetch=async(url)=>{const u=String(url);if(!u.includes('/table/'))return Response.json({elements:[]});const points=u.split('/driving/')[1].split('?')[0].split(';').map(p=>p.split(',').map(Number));return Response.json({code:'Ok',sources:points.map(location=>({location})),destinations:points.map(location=>({location})),durations:points.map((_,i)=>points.map((_,j)=>i===j?0:780)),distances:points.map((_,i)=>points.map((_,j)=>i===j?0:6200))});};
it('expands a one-attraction AI reply into full A/B/C days through 19–20h',async()=>{
 const b={...defaultBasics,mode:'real' as const,region:'강릉',days:4,travelHours:{start:540,end:1200}};
 const {basics}=validateBatch(b,conditions,catalog,{days:[1,2,3,4].map(day=>({day,candidateIds:[catalog.places[day-1].id]}))});
 const trip=await prepareTrip(basics,conditions,catalog,fetcher);
 for(const day of [1,2,3,4]){
  const options=dailyCourseOptions(trip,day);expect(options).toHaveLength(3);
  for(const option of options){
   const plan=basics.coursePlans!.find(p=>p.day===day)!;
   const next=await prepareTrip(savePlan(trip.basics,{...plan,selectedPlaceIds:option.ids,orderedPlaceIds:option.ids,startPlaceId:option.ids[0]}),conditions,catalog,fetcher);
   const rows=next.items.filter(i=>i.day===day);
   expect(rows.filter(i=>i.kind==='visit').length).toBeGreaterThanOrEqual(3);
   expect(rows.filter(i=>i.kind==='visit'&&i.start>=780).length).toBeGreaterThanOrEqual(2);
   expect(Math.max(...rows.filter(i=>i.label==='식사 전 휴식').map(i=>i.end-i.start),0)).toBeLessThanOrEqual(90);
   expect(rows.some(i=>i.label==='점심 식사')).toBe(true);
   expect(rows.some(i=>i.label==='저녁 식사')).toBe(true);
   expect(rows.at(-1)!.end).toBeGreaterThanOrEqual(1140);expect(rows.at(-1)!.end).toBeLessThanOrEqual(1200);
   expect(rows.some(i=>i.label==='운영 시작 전 여유 시간')).toBe(false);
   for(let i=1;i<rows.length;i++)expect(rows[i].start).toBeGreaterThanOrEqual(rows[i-1].end);
  }
 }
});
it('keeps explicit short and daily time windows instead of forcing an evening finish',async()=>{
 const b={...defaultBasics,mode:'real' as const,region:'강릉',days:1,travelHours:{start:780,end:1020},dailyHours:[{day:1,hours:{start:780,end:960}}]};
 const {basics}=validateBatch(b,conditions,catalog,{days:[{day:1,candidateIds:[catalog.places[0].id]}]});
 const trip=await prepareTrip(basics,conditions,catalog,fetcher);expect(trip.items.at(-1)!.end).toBeLessThanOrEqual(960);expect(trip.items.some(i=>i.label==='저녁 식사')).toBe(false);
});

import {expect,it} from 'vitest';
import {osmCatalog} from '../src/adapters/real-data';
import {defaultBasics,defaultConditions,tripSchema,type Trip} from '../src/domain/schema';
import {recordVenue} from '../src/domain/venue-facts';
import {confirmedFacilities,availability} from '../src/domain/venue-details';
import {refreshCatalog} from '../src/domain/catalog-refresh';
import {forecastHazards,forecastWeather} from '../src/domain/live-weather';
import {replacementInput,applyReplacement} from '../src/domain/replacements';
import {dayStops,parseRoadTable,improveRoadOrder,parseDayRoad,roadBasePlan,roadDayProposal} from '../src/domain/road-day';
import {optimizeTaxiOrder} from '../src/domain/taxi-plan';
import {indoorAlternative} from '../src/domain/indoor-alternative';
import {undo} from '../src/domain/engine';
const at=new Date().toISOString(),date=at.slice(0,10);
const catalog=osmCatalog('서울',{elements:[1,2,3,4].map(i=>({type:'node',id:i,lat:37.5+i/100,lon:127,tags:{name:'장소'+i,tourism:'museum',indoor:i===1?'no':'yes'}}))},at);
const trip=():Trip=>({version:1,id:'review-fixes',revision:0,basics:{...defaultBasics,date,days:1,region:'서울',mode:'real',transport:'driving'},conditions:defaultConditions,catalog:structuredClone(catalog),history:[],feedback:[],items:catalog.places.slice(0,3).map((p,i)=>({id:'v'+i,kind:'visit',day:1,start:540+i*80,end:570+i*80,placeId:p.id,fromId:null,toId:null,transport:null,locked:false,mode:'real'}))});
const forecast={date,fetchedAt:at,latitude:37.51,longitude:127,timezone:'Asia/Seoul',code:67,high:-10,low:-15,rainChance:80,wind:65,current:null,currentTime:null};
it('all concurrent weather hazards are retained; replacement recommendation and apply reject stale forecasts',()=>{
 expect(forecastHazards(forecast)).toEqual(expect.arrayContaining(['강풍','결빙·어는 비','비','한파']));expect(forecastWeather(forecast)).toBe('storm');expect(forecastWeather({...forecast,wind:20})).toBe('snow');
 const t=trip();t.basics.coursePreferences=[{day:1,visitMinutes:60,weather:'rain',forecast:{...forecast,fetchedAt:'2020-01-01T00:00:00.000Z'}}];
 expect(()=>replacementInput(t,'v0')).toThrow('예보를 다시');expect(()=>applyReplacement(t,'v0',catalog.places[3].id)).toThrow('예보를 다시');
});
it('fresh positive facility facts are required, operating hours/closed dates and reservations are distinct',()=>{
 const t=trip(),p=recordVenue(catalog.places[0],{source:'https://example.org/venue',at,walkMin:null,walkM:null,stairs:null,seat:null,cost:null,foods:null,facilities:{parking:true,toilet:false},opening:{open:600,close:1080,closedWeekdays:[],closedDates:[date],reservationRequired:true}});
 expect(confirmedFacilities(p,['parking'])).toBe(true);expect(confirmedFacilities(p,['toilet'])).toBe(false);expect(confirmedFacilities(p,['elevator'])).toBe(false);
 expect(confirmedFacilities({...p,facilities:{parking:{...p.facilities!.parking!,collectedAt:'2020-01-01T00:00:00Z'}}},['parking'])).toBe(false);
 expect(p.hours.value).toEqual([600,1080]);expect(availability(p,date,540,600).map(i=>i.message)).toEqual(expect.arrayContaining(['등록한 운영 정보상 이 날짜는 휴무입니다.','방문 시간이 등록한 운영시간 밖입니다.','예약이 필요한 장소입니다. 예약 완료 여부를 확인하세요.']));
 expect(availability(p,date,600,650,true).some(i=>i.message.includes('예약'))).toBe(false);
 t.catalog!.places[0]=p;const fresh=refreshCatalog(t,catalog,'서울');expect(fresh.places[0].facilities?.parking?.value).toBe(true);expect(fresh.places[0].opening?.value?.closedDates).toContain(date);
});
it('directed road matrix improves the path while preserving start/end/return',()=>{
 const p=catalog.places.slice(0,3),ids=p.map(p=>p.id),coords=p.map(p=>({location:[p.longitude,p.latitude]}));
 const table=parseRoadTable({code:'Ok',sources:coords,destinations:coords,durations:[[0,100,10],[20,0,100],[100,10,0]],distances:[[0,1000,100],[200,0,1000],[1000,100,0]]},p);
 expect(improveRoadOrder(table,ids,ids[0],undefined,false,'time').order).toEqual([ids[0],ids[2],ids[1]]);
 expect(improveRoadOrder(table,ids,ids[0],ids[2],false,'time').order.at(-1)).toBe(ids[2]);
 expect(improveRoadOrder(table,ids,ids[0],undefined,true,'time').after).toBe(40);
 expect(()=>parseRoadTable({...table,durations:[[0]]},p)).toThrow('크기');
 const blocked={...table,durations:table.durations.map(row=>row.map(()=>null))};expect(()=>improveRoadOrder(blocked,ids,ids[0],undefined,false,'time')).toThrow('연결');
});
it('full-day road proposal updates real distance, costs and times atomically and undo restores the prior plan',()=>{
 const t=trip(),p=dayStops(t,1);const ordered=[p[0],p[2],p[1]];
 const initial=optimizeTaxiOrder(p,p.map(p=>p.id),p[0].id,2,null,null,at,{day:1,transport:'driving',drivingCosts:{kmPerLiter:10,fuelPrice:1700,parking:5000,tolls:1000}});if('error'in initial)throw Error(initial.error);t.basics.taxiPlan=initial.plan;
 const stops=ordered.map(p=>({location:[p.longitude,p.latitude]}));const raw={code:'Ok',waypoints:stops,routes:[{distance:6000,duration:1200,geometry:{type:'LineString',coordinates:stops.map(p=>p.location)},legs:[{distance:2000,duration:300},{distance:4000,duration:900}]}]};
 const road=parseDayRoad(raw,ordered);const proposed=roadDayProposal(t,1,roadBasePlan(t,1,p),ordered,road);
 expect(proposed.plan.distanceBasis).toBe('road');expect(proposed.plan.distanceKm).toBe(6);expect(proposed.plan.estimatedFare).toBe(7020);
 expect(proposed.trip.items.filter(i=>i.kind==='move').map(i=>i.end-i.start)).toEqual([5,15]);expect(proposed.trip.catalog!.routes.map(r=>r.distanceM?.value)).toEqual([2000,4000]);
 expect(tripSchema.safeParse(proposed.trip).success).toBe(true);const restored=undo(proposed.trip);expect(restored.items).toEqual(t.items);expect(restored.basics).toEqual(t.basics);
 expect(()=>parseDayRoad({...raw,waypoints:stops.slice(0,2)},ordered)).toThrow();
 t.items[0].locked=true;expect(()=>roadBasePlan(t,1,p)).toThrow('고정');
});
it('indoor alternative is preview-only, keeps fixed items and collapses changes into one undo action',()=>{
 const t=trip();t.basics.coursePreferences=[{day:1,weather:'rain',visitMinutes:60}];const snapshot=JSON.stringify(t);const result=indoorAlternative(t,1);
 expect(result.changes).toHaveLength(1);expect(JSON.stringify(t)).toBe(snapshot);expect(result.trip.items[0].placeId).toBe(catalog.places[3].id);expect(undo(result.trip).items).toEqual(t.items);
 t.items[0].locked=true;expect(indoorAlternative(t,1).changes).toHaveLength(0);
});

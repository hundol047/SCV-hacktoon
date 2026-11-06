import {roadURL,parseRoadRoute,roadFact} from '../domain/road-route';
import {dayDate,type Trip} from '../domain/schema';
import {haversineKm,optimizeTaxiOrder} from '../domain/taxi-plan';
import {prepareTrip} from './prepare-trip';
import {forecastURL,parseForecast,forecastWeather} from '../domain/live-weather';
import {closedOn} from '../domain/venue-details';
import type {Weather} from '../domain/weather';
import {visitDuration} from '../domain/visit-duration';
export async function replanTrip(trip:Trip,day:number,from:number,weather:Weather|'auto',scores:Record<string,number>,fetcher:typeof fetch=fetch,completed?:string[]){
 const catalog=trip.catalog,b=trip.basics;if(!catalog||!b.travelHours)throw Error('시간이 지정된 여행 일정이 필요합니다.');
 const todayRows=trip.items.filter(i=>i.day===day);if(completed?.some(id=>todayRows.some(i=>i.placeId===id&&(i.kind==='visit'||i.kind==='meal')&&i.end>from)))throw Error('완료한 장소의 종료 시각 이후로 다시 시작 시간을 선택하세요.');const done=new Set(completed);const preserved=todayRows.filter(i=>i.locked||(completed?i.end<=from&&(i.placeId?done.has(i.placeId):!!i.toId&&done.has(i.toId)):i.start<from)).map(i=>completed?{...i,locked:true}:i);if(preserved.some(i=>i.locked&&i.start>=from))throw Error('남은 일정에 고정한 장소가 있습니다. 해당 장소 이후 시간으로 재추천하거나 고정을 해제하세요.');
 const cursor=Math.max(from,...preserved.map(i=>i.end));const end=b.dailyHours?.find(w=>w.day===day)?.hours.end??b.travelHours.end;if(cursor>=end)throw Error('종료 전 남은 시간이 없습니다. 여행 종료 시간을 조정해 주세요.');
 const latest=preserved.at(-1);const anchor=catalog.places.find(p=>p.id===(latest?.kind==='move'?latest.toId:latest?.placeId))??catalog.places.find(p=>p.id===todayRows.find(i=>i.kind==='visit')?.placeId);if(!anchor||anchor.latitude===undefined||anchor.longitude===undefined)throw Error('현재 일정 위치를 확인하지 못했습니다.');
 let resolved:Weather=weather==='auto'?'unknown':weather;
 if(weather==='auto'){const response=await fetcher(forecastURL(anchor.latitude,anchor.longitude),{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('날씨 조회가 지연됩니다. 현재 날씨를 직접 선택해 주세요.');resolved=forecastWeather(parseForecast(await response.json(),dayDate(b,day),anchor.latitude,anchor.longitude));}
 if(resolved==='storm')throw Error('강풍·뇌우 상황에서는 자동 여행 재추천을 중단합니다. 여행을 미루거나 안전한 실내에 머물러 주세요.');
 const bad=['rain','snow','heat','cold'].includes(resolved);const visited=new Set(trip.items.filter(i=>i.day!==day||preserved.some(p=>p.id===i.id)).map(i=>i.placeId));
 const region=b.destinations?.find(d=>d.startDay<=day&&d.endDay>=day)?.region??b.region;
 const candidates=catalog.places.filter(p=>(p.region??catalog.region)===region&&p.kind==='visit'&&!visited.has(p.id)&&(scores[p.id]??0)>=0&&!closedOn(p,dayDate(b,day))&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&(!bad||p.setting?.value==='indoor'))
  .sort((a,d)=>(scores[d.id]??0)-(scores[a.id]??0)||(haversineKm(anchor,a)??Infinity)-(haversineKm(anchor,d)??Infinity));
 const limit=Math.max(1,Math.min(3,Math.floor((end-cursor)/120)));const chosen=candidates.filter(p=>visitDuration(p)<=end-cursor).slice(0,limit);if(!chosen.length)throw Error(bad?'남은 시간에 맞는 실내 확인 장소가 없습니다. 기존 일정은 유지합니다.':'조건에 맞는 대체 장소가 없습니다. 기존 일정은 유지합니다.');
 const order=optimizeTaxiOrder(catalog.places,chosen.map(p=>p.id),chosen[0].id,b.travelers??1,null,null,undefined,{allowSingle:true,day:1,transport:b.transport as 'taxi'|'driving'});if('error'in order)throw Error(order.error);
 // Include the current position to the first replacement as an outbound leg.
 const revised=await prepareTrip({...b,date:dayDate(b,day),days:1,travelHours:{start:cursor,end},startMode:'home',departureCoordinates:{latitude:anchor.latitude,longitude:anchor.longitude},departureRegion:anchor.name,returnBy:undefined,lodgings:undefined,dailyHours:undefined,dayWindows:undefined,commutes:undefined,destinations:undefined,transfers:undefined,travelDays:undefined,coursePreferences:undefined,coursePlans:[order.plan],taxiPlan:order.plan},trip.conditions,catalog,fetcher);
 const incoming=revised.basics.commutes?.find(c=>c.kind==='outbound');const rows=revised.items.map(i=>({...i,day,id:`replan:${trip.revision+1}:${day}:${i.id}`}));
 const first=rows.find(i=>i.kind==='visit');if(incoming&&first&&incoming.minutes>0)rows.unshift({id:`replan:${trip.revision+1}:${day}:arrival`,day,start:cursor,end:cursor+incoming.minutes,kind:'move',placeId:null,fromId:anchor.id,toId:first.placeId,transport:b.transport,locked:false,mode:'real'});
 // Retain tonight's selected hotel, including the newly measured final transfer.
 const stay=b.lodgings?.find(h=>h.night===day);
 if(stay){const last=rows.filter(i=>i.placeId).at(-1)!;const venue=catalog.places.find(p=>p.id===last.placeId)??revised.catalog!.places.find(p=>p.id===last.placeId)!;const hotel=catalog.places.find(p=>p.id===`stay:${stay.night}:${stay.id}`);if(!hotel)throw Error('숙소 위치를 다시 선택해 주세요.');const r=await fetcher(roadURL(venue,hotel),{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('숙소 이동을 확인하지 못했습니다. 기존 일정은 유지합니다.');const road=parseRoadRoute(await r.json(),venue,hotel),m=Math.ceil(road.seconds/60),arrival=last.end+m,checkIn=Math.max(arrival,stay.checkIn);if(checkIn+15>end)throw Error('숙소까지 이동하면 종료 시간을 넘습니다. 재추천 시작 시간을 앞당겨 주세요.');const fact=roadFact(road,venue,hotel,b.transport as 'taxi'|'driving');revised.catalog!.routes.push(fact);rows.push({id:`replan:${trip.revision+1}:hotel-road`,day,start:last.end,end:arrival,kind:'move',placeId:null,fromId:venue.id,toId:hotel.id,transport:b.transport,locked:false,mode:'real'},{id:`replan:${trip.revision+1}:hotel`,day,start:checkIn,end:checkIn+15,kind:'rest',placeId:hotel.id,fromId:null,toId:null,transport:null,locked:false,mode:'real',label:'체크인'});}
 // prepareTrip removes unselected hotel nodes; restore other days' hotel points and routes.
 revised.catalog!.places=[...revised.catalog!.places,...catalog.places.filter(p=>p.id.startsWith('stay:')&&!revised.catalog!.places.some(q=>q.id===p.id))];
 revised.catalog!.routes=[...catalog.routes.filter(r=>!revised.catalog!.routes.some(q=>q.id===r.id)),...revised.catalog!.routes];
 let commutes=b.commutes;
 if(day===b.days&&b.returnBy!==undefined&&b.departureCoordinates){const last=revised.items.filter(i=>i.placeId).at(-1)!;const venue=revised.catalog!.places.find(p=>p.id===last.placeId)!;const home={...venue,...b.departureCoordinates,id:'departure'};const r=await fetcher(roadURL(venue,home),{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('귀가 경로를 확인하지 못했습니다. 기존 일정을 유지합니다.');const route=parseRoadRoute(await r.json(),venue,home),minutes=Math.ceil(route.seconds/60);if(last.end+minutes>b.returnBy)throw Error('재추천 장소에서 귀가 시간을 지킬 수 없습니다. 기존 일정을 유지합니다.');commutes=[...(b.commutes??[]).filter(c=>c.kind!=='homebound'),{day,kind:'homebound',minutes,distanceKm:route.distance/1000,depart:last.end,arrive:last.end+minutes}];}
 if(incoming&&first){const target=revised.catalog!.places.find(p=>p.id===first.placeId)!;const fact=roadFact({distance:incoming.distanceKm*1000,seconds:incoming.minutes*60,points:[],fromAccess:0,toAccess:0,fetchedAt:revised.basics.roadCheckedAt!},anchor,target,b.transport as 'taxi'|'driving');revised.catalog!.routes=[...revised.catalog!.routes.filter(r=>r.id!==fact.id),fact];}
 const items=[...trip.items.filter(i=>i.day!==day),...preserved,...rows].sort((a,d)=>a.day-d.day||a.start-d.start);
 if(rows.some(i=>i.end>end))throw Error('이동을 포함하면 남은 시간을 넘습니다. 기존 일정을 유지합니다.');
 const ordered=[...new Set(items.filter(i=>i.day===day&&i.placeId&&!i.placeId.startsWith('stay:')).map(i=>i.placeId!))];const mergedPlan={...revised.basics.coursePlans![0],day,selectedPlaceIds:ordered,orderedPlaceIds:ordered,startPlaceId:ordered[0]};
 return {...trip,revision:trip.revision+1,history:[...trip.history,trip.items].slice(-20),historyBasics:[...(trip.historyBasics??[]),trip.basics].slice(-20),items,catalog:revised.catalog,basics:{...b,commutes,roadCheckedAt:revised.basics.roadCheckedAt,coursePlans:[...(b.coursePlans??[]).filter(p=>(p.day??1)!==day),mergedPlan],taxiPlan:undefined}};
}

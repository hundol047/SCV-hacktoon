import {z} from 'zod';
import type {Place} from '../data/demo';
import {type Trip,type TaxiPlan,taxiPlanSchema} from './schema';
import {savedPlans,savePlan} from './course-plans';
import {haversineKm,optimizeTaxiOrder} from './taxi-plan';
import {parseRoadRoute,roadFact,type RoadRoute} from './road-route';
import {vehicleDayError} from './vehicle-day';
import {validateSchedule} from './validate';
import {applyProposal} from './engine';
import {optimize} from './optimizer';
export function dayStops(trip:Trip,day:number){
 const ids=trip.items.filter(i=>i.day===day&&i.kind!=='move'&&i.placeId).sort((a,b)=>a.start-b.start).map(i=>i.placeId!);
 const sequence=ids.filter((id,i)=>i===0||id!==ids[i-1]);
 if(new Set(sequence).size!==sequence.length)throw Error('같은 장소를 여러 번 방문하는 날은 구간별 조회를 이용하세요.');
 if(sequence.length<2||sequence.length>20)throw Error('하루에 좌표 있는 장소 2~20곳이 필요합니다.');
 const places=sequence.map(id=>trip.catalog?.places.find(p=>p.id===id));
 if(places.some(p=>!p||haversineKm(p,p)===null))throw Error('모든 장소의 좌표가 필요합니다.');
 return places as Place[];
}
function coordinates(places:Place[]){if(places.length<2||places.length>21||places.some(p=>haversineKm(p,p)===null))throw Error('경로 좌표를 확인하세요.');return places.map(p=>`${p.longitude},${p.latitude}`).join(';');}
export const tableURL=(places:Place[])=>'https://router.project-osrm.org/table/v1/driving/'+coordinates(places)+'?annotations=duration,distance';
export const dayRoadURL=(places:Place[])=>'https://router.project-osrm.org/route/v1/driving/'+coordinates(places)+'?overview=full&geometries=geojson&steps=false&alternatives=false';
const point=z.tuple([z.number().min(-180).max(180),z.number().min(-90).max(90)]);
const matrix=z.array(z.array(z.number().nonnegative().nullable()).max(20)).max(20);
function checkSnap(places:Place[],locations:[number,number][]){if(places.length!==locations.length||places.some((p,i)=>haversineKm(p,{latitude:locations[i][1],longitude:locations[i][0]})!>1))throw Error('장소와 도로 연결점이 1km 넘게 떨어져 있습니다. 승하차 위치를 확인하세요.');}
export function parseRoadTable(raw:unknown,places:Place[]){
 const d=z.object({code:z.literal('Ok'),durations:matrix,distances:matrix,sources:z.array(z.object({location:point})),destinations:z.array(z.object({location:point}))}).parse(raw);
 const n=places.length;if([d.durations,d.distances].some(m=>m.length!==n||m.some(row=>row.length!==n)))throw Error('도로 비교 표 크기가 맞지 않습니다.');
 checkSnap(places,d.sources.map(p=>p.location));checkSnap(places,d.destinations.map(p=>p.location));return d;
}
export function improveRoadOrder(table:ReturnType<typeof parseRoadTable>,original:string[],start:string,end:string|undefined,returning:boolean,priority:'time'|'distance'){
 if(original[0]!==start||end&&(end===start||!original.includes(end)||returning))throw Error('고정 출발·도착 장소를 확인하세요.');
 const m=priority==='time'?table.durations:table.distances;
 const score=(order:string[])=>{const all=returning?[...order,start]:order;return all.slice(1).reduce((sum,id,i)=>sum+(m[original.indexOf(all[i])][original.indexOf(id)]??Infinity),0);};
 let best=[...original];if(end)best=[...best.filter(id=>id!==end),end];
 const left=new Set(original.filter(id=>id!==start&&id!==end)),greedy=[start];
 while(left.size){const from=original.indexOf(greedy.at(-1)!);const next=[...left].sort((a,b)=>(m[from][original.indexOf(a)]??Infinity)-(m[from][original.indexOf(b)]??Infinity)||a.localeCompare(b))[0];greedy.push(next);left.delete(next);}
 if(end)greedy.push(end);if(score(greedy)<score(best))best=greedy;
 // Directed-road costs: evaluate the whole reversed path, never assume symmetry.
 for(let pass=0;pass<100;pass++){
  let changed=false;
  for(let i=1;i<best.length-1&&!changed;i++)for(let j=i+1;j<best.length-Number(!!end);j++){
   const next=[...best.slice(0,i),...best.slice(i,j+1).reverse(),...best.slice(j+1)];
   if(score(next)+0.01<score(best)){best=next;changed=true;break;}
  }if(!changed)break;
 }
 if(!Number.isFinite(score(best)))throw Error('선택한 장소를 모두 연결하는 자동차 경로가 없습니다.');
 return {order:best,before:score(original),after:score(best)};
}
export type DayRoad=RoadRoute&{legs:{distance:number;duration:number}[]};
export function parseDayRoad(raw:unknown,places:Place[]):DayRoad{
 const d=z.object({waypoints:z.array(z.object({location:point})).max(21),routes:z.array(z.object({legs:z.array(z.object({distance:z.number().nonnegative(),duration:z.number().nonnegative()})).max(20)})).min(1)}).parse(raw);
 checkSnap(places,d.waypoints.map(p=>p.location));if(d.routes[0].legs.length!==places.length-1)throw Error('이동 구간 수가 맞지 않습니다.');
 const r=parseRoadRoute(raw,places[0],places.at(-1)!);const legs=d.routes[0].legs;
 if(Math.abs(legs.reduce((s,l)=>s+l.distance,0)-r.distance)>Math.max(2,legs.length)||Math.abs(legs.reduce((s,l)=>s+l.duration,0)-r.seconds)>Math.max(2,legs.length))throw Error('구간별 거리·시간 합계가 맞지 않습니다.');
 return {...r,legs};
}
export function roadBasePlan(trip:Trip,day:number,places:Place[]):TaxiPlan{
 if(!trip.catalog||!['driving','taxi'].includes(trip.basics.transport))throw Error('자가용 또는 택시 여행에서 사용할 수 있습니다.');
 const error=vehicleDayError(trip.basics,trip.catalog,day,places.map(p=>p.id));if(error)throw Error(error);
 if(trip.items.some(i=>i.day===day&&i.locked))throw Error('고정된 일정이 있는 날은 순서를 바꾸지 않습니다. 구간별 조회를 이용하세요.');
 const saved=savedPlans(trip.basics).find(p=>(p.day??1)===day);
 if(saved){if(saved.selectedPlaceIds.length!==places.length||saved.selectedPlaceIds.some(id=>!places.some(p=>p.id===id)))throw Error('저장된 코스와 일정 장소가 다릅니다. 방문 순서를 먼저 다시 계산하세요.');return saved;}
 const result=optimizeTaxiOrder(places,places.map(p=>p.id),places[0].id,1,null,null,undefined,{day,transport:trip.basics.transport as 'driving'|'taxi'});
 if('error'in result)throw Error(result.error);return result.plan;
}
export function roadDayProposal(trip:Trip,day:number,base:TaxiPlan,order:Place[],road:DayRoad){
 if(!trip.catalog)throw Error('장소 자료가 없습니다.');
 const stops=base.returnToStart?[...order,order[0]]:order;
 if(road.legs.length!==stops.length-1)throw Error('이동 구간 불일치');
 const km=road.distance/1000,cost=base.drivingCosts;
 const estimatedFare=base.transport==='driving'?(cost?Math.ceil((km/cost.kmPerLiter*cost.fuelPrice+cost.parking+cost.tolls)*base.vehicles):null):base.baseFare!==null&&base.perKmFare!==null?Math.ceil((road.legs.length*base.baseFare+km*base.perKmFare)*base.vehicles):null;
 const plan=taxiPlanSchema.parse({...base,day,orderedPlaceIds:order.map(p=>p.id),startPlaceId:order[0].id,distanceKm:km,distanceBasis:'road',roadFetchedAt:road.fetchedAt,estimatedFare});
 const facts=road.legs.map((leg,i)=>roadFact({...road,distance:leg.distance,seconds:leg.duration},stops[i],stops[i+1],trip.basics.transport as 'taxi'|'driving'));
 const catalog={...trip.catalog,routes:[...trip.catalog.routes.filter(r=>!facts.some(f=>f.id===r.id)),...new Map(facts.map(f=>[f.id,f])).values()]};
 const basics=savePlan(trip.basics,plan);
 // Rebuild only this day; preserve all other dates and validate the combined result.
 const generated=optimize(trip.conditions,{...basics,coursePlans:undefined,taxiPlan:plan},trip.items,[],catalog);
 const items=generated.items.map(i=>i.day===day?{...i,id:`road:d${day}:${i.id}`} :i);
 const report=validateSchedule(items,trip.conditions,basics,catalog);
 if(generated.blocked||report.issues.some(i=>i.status==='violation'||i.status==='conflict'))throw Error('이동 시간이 늘어 하루 일정에 여유가 필요합니다. 장소를 줄이거나 체류 시간을 조정해 주세요. '+(generated.blocked?generated.reasons.slice(0,1).join(' '):''));
 return {trip:{...applyProposal(trip,items),basics,catalog},plan,report};
}

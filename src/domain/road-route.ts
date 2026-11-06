// Port of HYUNDAI NavigationService / NavigationGeometry OSRM route handling.
import {z} from 'zod';
import type {Place,Route,Fact} from '../data/demo';
import {haversineKm} from './taxi-plan';
const coord=z.tuple([z.number().min(-180).max(180),z.number().min(-90).max(90)]);
export type RoadRoute={distance:number;seconds:number;points:[number,number][];fromAccess:number;toAccess:number;fetchedAt:string};
export function roadURL(from:Place,to:Place){if(haversineKm(from,to)===null)throw Error('유효한 출발·도착 좌표가 필요합니다.');return `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&steps=false&alternatives=false`;}
export function parseRoadRoute(raw:unknown,from:Place,to:Place):RoadRoute{
  const data=z.object({code:z.literal('Ok'),routes:z.array(z.object({distance:z.number().nonnegative().max(50000000),duration:z.number().nonnegative().max(3000000),geometry:z.object({type:z.literal('LineString'),coordinates:z.array(coord).min(2).max(150000)})})).min(1)}).safeParse(raw);
  if(!data.success)throw Error('연결 가능한 자동차 도로 경로가 없거나 응답이 올바르지 않습니다.');
  const r=data.data.routes[0],points=r.geometry.coordinates;
  const gap=(p:Place,c:[number,number])=>{const km=haversineKm(p,{latitude:c[1],longitude:c[0]});if(km===null)throw Error('좌표 오류');return km*1000;};
  const fromAccess=gap(from,points[0]),toAccess=gap(to,points[points.length-1]);
  if(fromAccess>1000||toAccess>1000)throw Error('장소에서 1km 이내에 연결되는 자동차 도로가 없습니다. 승하차 지점을 확인하세요.');
  return {distance:r.distance,seconds:r.duration,points,fromAccess,toAccess,fetchedAt:new Date().toISOString()};
}
export function roadFact(r:RoadRoute,from:Pick<Place,'id'>,to:Pick<Place,'id'>,transport:'taxi'|'driving'):Route{
  const id=`r:${from.id}:${to.id}:${transport}`;
  const fact=<T>(field:string,value:T|null):Fact<T>=>({value,evidenceId:`${id}:${field}`,source:'https://router.project-osrm.org',nature:'real',checked:value===null?'unknown':'source',collectedAt:r.fetchedAt});
  return {id,fromId:from.id,toId:to.id,transport,mode:'real',distanceM:fact('distanceM',r.distance),duration:fact('duration',Math.ceil(r.seconds/60)),walkMin:fact<number>('walkMin',null),walkM:fact<number>('walkM',null),cost:fact<number>('cost',null),stairs:fact<boolean>('stairs',null)};
}

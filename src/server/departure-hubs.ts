import {z} from 'zod';
import {haversineKm} from '../domain/taxi-plan';
import type {RPC} from './store';
export const hubPoint=z.object({latitude:z.number().min(33).max(39),longitude:z.number().min(124).max(132)});
export type Hub={id:string;name:string;kind:'bus'|'rail';latitude:number;longitude:number;distanceKm:number};
const element=z.object({type:z.enum(['node','way','relation']),id:z.number().int().positive(),lat:z.number().optional(),lon:z.number().optional(),center:z.object({lat:z.number(),lon:z.number()}).optional(),tags:z.record(z.string(),z.string()).optional()});
export function parseHubs(raw:unknown,point:z.infer<typeof hubPoint>):Hub[]{
 const data=z.object({elements:z.array(element).max(3000),remark:z.string().optional()}).parse(raw);if(data.remark)throw Error('Incomplete transport data');
 const found:Hub[]=[];for(const e of data.elements){const t=e.tags??{},name=t['name:ko']||t.name;if(!name||name.length>300)continue;const kind=t.amenity==='bus_station'?'bus':t.railway==='station'&&!['subway','light_rail','monorail'].includes(t.station)&&t.subway!=='yes'?'rail':null;if(!kind)continue;
 const latitude=e.lat??e.center?.lat,longitude=e.lon??e.center?.lon;const coords=hubPoint.safeParse({latitude,longitude});if(!coords.success)continue;const distanceKm=haversineKm(point,coords.data)!;if(distanceKm>25)continue;if(found.some(h=>h.kind===kind&&h.name===name&&haversineKm(h,coords.data)!<0.5))continue;found.push({id:`${e.type}:${e.id}`,name,kind,...coords.data,distanceKm:Math.round(distanceKm*10)/10});}
 return ['bus','rail'].flatMap(kind=>found.filter(h=>h.kind===kind).sort((a,b)=>a.distanceKm-b.distanceKm||a.id.localeCompare(b.id)).slice(0,3));
}
const cache=new Map<string,{at:number;hubs:Hub[]}>();
export async function departureHubs(point:z.infer<typeof hubPoint>,rpc:RPC,fetcher:typeof fetch=fetch){
 const key=point.latitude.toFixed(4)+','+point.longitude.toFixed(4);const saved=cache.get(key);if(saved&&Date.now()-saved.at<6*3600000)return saved.hubs;
 if(!(await rpc.call('bopok_geo_guard',{p_provider:'overpass'})).allowed)throw Error('Busy');
 const around=`around:25000,${point.latitude},${point.longitude}`;const query=`[out:json][timeout:7];(nwr(${around})[amenity=bus_station][name];nwr(${around})[railway=station][name];);out center tags;`;
 const r=await fetcher('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Yeohaengit/0.18'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(9000),redirect:'error'});if(!r.ok)throw Error('Provider');const text=await r.text();if(text.length>2000000)throw Error('Too large');const hubs=parseHubs(JSON.parse(text),point);if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),hubs});return hubs;
}

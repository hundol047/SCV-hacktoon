import {locationQuery} from '../domain/location-query';
import {vworldLocation} from './vworld-location';
import {z} from 'zod';
import {locationsSchema} from '../domain/location';
import {hash} from './security';
import type {RPC} from './store';
export class LocationSearchError extends Error{constructor(public code:'BUSY'|'PROVIDER'|'STORAGE'){super(code);}}
export async function searchLocation(query:string,rpc:RPC,fetcher:typeof fetch=fetch){
 query=locationQuery(query);
 if(process.env.BOPok_VWORLD_KEY?.trim()){
  const officialKey='location:vworld-v1:'+hash(query.normalize('NFKC').trim().replace(/\s+/g,' '));
  const cachedOfficial=await rpc.call('bopok_cache',{p_key:officialKey});if(cachedOfficial)return locationsSchema.parse(cachedOfficial);
  const official=await vworldLocation(query,fetcher);if(official.length){await rpc.call('bopok_cache',{p_key:officialKey,p_value:official});return official;}
 }
 const key='location:'+hash(query.normalize('NFKC').trim().replace(/\s+/g,' '));
 const cached=await rpc.call('bopok_cache',{p_key:key});if(cached)return locationsSchema.parse(cached);
 if(!(await rpc.call('bopok_geo_guard',{p_provider:'nominatim'})).allowed)throw new LocationSearchError('BUSY');
 const url='https://nominatim.openstreetmap.org/search?'+new URLSearchParams({q:query,format:'jsonv2',limit:'5',addressdetails:'1',countrycodes:'kr','accept-language':'ko'});
 let rows;
 try{const response=await fetcher(url,{headers:{'User-Agent':'Yeohaengit/0.16 (+https://github.com/hundol047/SCV-hacktoon)'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error();rows=z.array(z.object({place_id:z.union([z.string(),z.number()]),name:z.string().optional(),display_name:z.string().max(1500),lat:z.coerce.number(),lon:z.coerce.number()})).max(5).parse(await response.json());}catch{throw new LocationSearchError('PROVIDER');}
 const locations=locationsSchema.parse(rows.map(r=>({id:String(r.place_id),name:(r.name||r.display_name.split(',')[0]).slice(0,300),address:r.display_name,latitude:r.lat,longitude:r.lon})));
 const unique=locations.filter((v,i,a)=>a.findIndex(x=>x.address===v.address&&x.latitude===v.latitude&&x.longitude===v.longitude)===i);
 await rpc.call('bopok_cache',{p_key:key,p_value:unique});return unique;
}

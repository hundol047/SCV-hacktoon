import {z} from 'zod';
import {locationResultSchema} from '../domain/location';
import type {RPC} from './store';
export const currentPointSchema=locationResultSchema.pick({latitude:true,longitude:true});
export async function reverseLocation(point:z.infer<typeof currentPointSchema>,rpc:RPC,fetcher:typeof fetch=fetch){
 const fallback={...point,id:'current-location',name:'현재 위치',address:'현재 위치'};
 // Preserve the device coordinates: a reverse-geocoded building centroid is not the user's position.
 try{
  if(!(await rpc.call('bopok_geo_guard',{p_provider:'nominatim'})).allowed)return fallback;
  const url='https://nominatim.openstreetmap.org/reverse?'+new URLSearchParams({lat:String(point.latitude),lon:String(point.longitude),format:'jsonv2','accept-language':'ko',zoom:'18'});
  const response=await fetcher(url,{headers:{'User-Agent':'Yeohaengit (+https://github.com/hundol047/SCV-hacktoon)'},signal:AbortSignal.timeout(5000)});
  if(!response.ok)return fallback;
  const data=z.object({display_name:z.string().min(1).max(1500)}).parse(await response.json());
  return {...fallback,address:data.display_name};
 }catch{return fallback;}
}

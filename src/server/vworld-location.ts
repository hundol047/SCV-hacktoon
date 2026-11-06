import {z} from 'zod';
import {locationsSchema,type LocationResult} from '../domain/location';
const item=z.object({id:z.union([z.string(),z.number()]),title:z.string().max(500),address:z.object({road:z.string().max(1500).optional(),parcel:z.string().max(1500).optional()}).optional(),point:z.object({x:z.coerce.number().min(123).max(133),y:z.coerce.number().min(30).max(40)})});
export function parseVWorld(raw:unknown):LocationResult[]{
 const response=z.object({response:z.object({status:z.enum(['OK','NOT_FOUND','ERROR']),result:z.object({items:z.array(item).max(5)}).optional()})}).parse(raw).response;
 if(response.status==='ERROR')throw Error('VWorld request rejected');if(response.status==='NOT_FOUND')return [];if(!response.result)throw Error('VWorld result missing');
 const places=locationsSchema.parse(response.result.items.map(p=>({id:('vworld:'+p.id).slice(0,100),name:p.title.trim().slice(0,300),address:(p.address?.road||p.address?.parcel||p.title).trim().slice(0,1500),latitude:p.point.y,longitude:p.point.x})).filter(p=>p.name));
 return places.filter((p,i,all)=>all.findIndex(x=>x.name===p.name&&x.latitude===p.latitude&&x.longitude===p.longitude)===i);
}
let day='',calls=0;
export async function vworldLocation(query:string,fetcher:typeof fetch=fetch):Promise<LocationResult[]>{
 const key=process.env.BOPok_VWORLD_KEY?.trim();if(!key)return [];
 const domain=process.env.BOPok_VWORLD_DOMAIN?.trim()||process.env.BOPok_APP_URL?.trim();
 const isAddress=/(?:로|길)(?:\s|\d|$)|(?:동|리|읍|면)\s*\d/.test(query);
 const types=isAddress?['road','parcel','place']:['place','road','parcel'];const deadline=Date.now()+6000;
 for(const type of types){const today=new Date().toISOString().slice(0,10);if(day!==today){day=today;calls=0;}if(calls>=1000||Date.now()>=deadline)return [];calls++;
  const params=new URLSearchParams({service:'search',request:'search',version:'2.0',crs:'EPSG:4326',size:'5',page:'1',query,type:type==='place'?'place':'address',format:'json',errorformat:'json',key,...(type==='place'?{}:{category:type}),...(domain?{domain}:{})});
  try{const response=await fetcher('https://api.vworld.kr/req/search?'+params,{redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(2500,deadline-Date.now())))});if(!response.ok)return [];const body=await response.text();if(body.length>100000)return [];const locations=parseVWorld(JSON.parse(body));if(locations.length)return locations;}catch{return [];}
 }return [];
}

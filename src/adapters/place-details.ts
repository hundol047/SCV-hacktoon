import {z} from 'zod';
import {placePhotoURL} from '../domain/place-photo';
const schema=z.object({imageUrl:z.string().optional(),imageUrls:z.array(z.string()).max(8).optional(),address:z.string().max(1000).optional(),hoursText:z.string().max(3000).optional(),phone:z.string().max(3000).optional(),website:z.string().max(3000).optional()});
export type PlaceDetails=z.infer<typeof schema>;
const cache=new Map<string,{at:number;value:PlaceDetails}>();const pending=new Map<string,Promise<PlaceDetails>>();
export async function loadPlaceDetails(ids:string[]){
 const unique=[...new Set(ids)].filter(id=>/^(tourapi:[1-9]\d{0,14}|osm:(node|way|relation):[1-9]\d{0,14})$/.test(id)).slice(0,200);
 const missing=unique.filter(id=>!pending.has(id)&&(!cache.has(id)||Date.now()-cache.get(id)!.at>60000));
 for(let i=0;i<missing.length;i+=8){const batch=missing.slice(i,i+8);
  const work=fetch('/api/place-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:batch}),signal:AbortSignal.timeout(20000)}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();const output:Record<string,PlaceDetails>={};for(const id of batch){const parsed=schema.safeParse(data.places?.[id]);if(!parsed.success)continue;const info=parsed.data;info.imageUrl=placePhotoURL(info.imageUrl);info.imageUrls=info.imageUrls?.map(placePhotoURL).filter((s):s is string=>!!s);output[id]=info;if(cache.size>=1000)cache.delete(cache.keys().next().value!);cache.set(id,{at:Date.now(),value:info});}return output;}).catch(()=>({} as Record<string,PlaceDetails>));
  for(const id of batch){const result=work.then(data=>data[id]??{}).finally(()=>pending.delete(id));pending.set(id,result);}
 }
 return Object.fromEntries(await Promise.all(unique.map(async id=>[id,pending.has(id)?await pending.get(id)!:cache.get(id)?.value??{}])));
}

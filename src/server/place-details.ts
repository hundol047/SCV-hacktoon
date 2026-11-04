import {z} from 'zod';
const element=z.object({type:z.enum(['node','way','relation']),id:z.number().int().positive(),tags:z.record(z.string(),z.string().max(3000)).optional()});
export function visitorInfo(tags:Record<string,string>){
 const website=tags.website??tags['contact:website'];
 const address=tags['addr:full']||[tags['addr:city'],tags['addr:street'],tags['addr:housenumber']].filter(Boolean).join(' ');
 return {address:address||undefined,hoursText:tags.opening_hours,phone:tags.phone??tags['contact:phone'],website:website&&/^https?:\/\//.test(website)?website:undefined};
}
const cache=new Map<string,{at:number;info:ReturnType<typeof visitorInfo>}>();
export async function fetchPlaceDetails(ids:string[],fetcher:typeof fetch=fetch){
 const output:Record<string,ReturnType<typeof visitorInfo>>={};const pending:string[]=[];
 for(const id of ids){const saved=cache.get(id);if(saved&&Date.now()-saved.at<6*3600000)output[id]=saved.info;else pending.push(id);}
 await Promise.all(['node','way','relation'].map(async type=>{
 const group=pending.filter(id=>id.startsWith('osm:'+type+':'));if(!group.length)return;
 const numbers=group.map(id=>id.split(':')[2]);
 try{
 const response=await fetcher(`https://www.openstreetmap.org/api/0.6/${type}s.json?${type}s=${numbers.join(',')}`,{headers:{'User-Agent':'Yeohaengit/0.16 (https://github.com/hundol047/SCV-hacktoon)'},signal:AbortSignal.timeout(8000)});
 if(!response.ok)return;
 const text=await response.text();if(text.length>2000000)return;
 const result=z.object({elements:z.array(element).max(10000)}).parse(JSON.parse(text));
 for(const e of result.elements){const id=`osm:${e.type}:${e.id}`;if(!group.includes(id))continue;const info=visitorInfo(e.tags??{});output[id]=info;if(cache.size>=500)cache.delete(cache.keys().next().value!);cache.set(id,{at:Date.now(),info});}
 }catch{/* Enrichment is optional; unavailable information is never invented. */}
 }));return output;
}

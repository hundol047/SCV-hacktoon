import type {KoreaRecord} from '../data/korea-tourism';
import {haversineKm} from '../domain/taxi-plan';
import {z} from 'zod';
import type {Place} from '../data/demo';
type Info=NonNullable<Place['visitorInfo']>;
const row=z.record(z.string(),z.union([z.string(),z.number()]));
const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
const text=(v:unknown,max=1000)=>typeof v==='string'?v.replace(/<br\s*\/?\s*>/gi,' · ').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim().slice(0,max):'';
export function matchingTourismPlace(place:Pick<KoreaRecord,'name'|'latitude'|'longitude'>,rows:Record<string,string|number>[]){
 const matches=rows.filter(r=>normalize(String(r.title??''))===normalize(place.name)&&/^\d+$/.test(String(r.contentid))&&/^(12|14|28|39)$/.test(String(r.contenttypeid))&&Number(r.mapy)>30&&Number(r.mapx)>120&&(haversineKm({latitude:place.latitude??undefined,longitude:place.longitude??undefined},{latitude:Number(r.mapy),longitude:Number(r.mapx)})??Infinity)<=0.5);
 return matches.length===1?matches[0]:null;
}
export function tourInfo(basic:Record<string,string|number>,intro:Record<string,string|number>):Info{
 const address=text([basic.addr1,basic.addr2].filter(Boolean).join(' '));const phone=text(intro.infocenter||intro.infocenterculture||intro.infocenterleports||intro.infocenterfood||basic.tel);
 const hours=text(intro.usetime||intro.usetimeculture||intro.usetimeleports||intro.opentimefood,2500);const closed=text(intro.restdate||intro.restdateculture||intro.restdateleports||intro.restdatefood,400);
 return {...(address?{address}:{}),...(phone?{phone}:{}),...(hours||closed?{hoursText:[hours,closed?'휴무: '+closed:''].filter(Boolean).join(' · ')}:{})};
}
export function createTourAPIEnricher(fetcher:typeof fetch=fetch){
 const cache=new Map<string,{at:number;info:Info}>();const pending=new Map<string,Promise<Info>>();let day='',requests=0;
 async function items(operation:string,params:Record<string,string>,key:string,deadline:number){
  const now=Date.now(),today=new Date(now).toISOString().slice(0,10);if(day!==today){day=today;requests=0;}if(now>=deadline||requests>=1000)throw Error('Tourism lookup limit');requests++;
  const query=new URLSearchParams({serviceKey:key,MobileOS:'ETC',MobileApp:'Yeohaengit',_type:'json',numOfRows:'20',pageNo:'1',...params});
  const response=await fetcher('https://apis.data.go.kr/B551011/KorService2/'+operation+'?'+query,{signal:AbortSignal.timeout(Math.max(1,Math.min(2500,deadline-now))),redirect:'error'});
  if(!response.ok)throw Error('Tourism lookup failed');const raw=await response.text();if(raw.length>500000)throw Error('Tourism response too large');
  const data=JSON.parse(raw)?.response;if(!['00','0000'].includes(String(data?.header?.resultCode)))throw Error('Tourism provider rejected request');
  const values=data?.body?.items?.item;return z.array(row).max(20).parse(Array.isArray(values)?values:values&&typeof values==='object'?[values]:[]);
 }
 async function lookup(place:KoreaRecord,key:string,deadline:number):Promise<Info>{
  const saved=cache.get(place.id);if(saved&&Date.now()-saved.at<6*3600000)return saved.info;const inflight=pending.get(place.id);if(inflight)return inflight;
  const work=(async()=>{try{const rows=await items('searchKeyword2',{keyword:place.name},key,deadline);const basic=matchingTourismPlace(place,rows);let info:Info={};if(basic){let intro:Record<string,string|number>={};try{intro=(await items('detailIntro2',{contentId:String(basic.contentid),contentTypeId:String(basic.contenttypeid)},key,deadline))[0]??{};}catch{}info=tourInfo(basic,intro);}if(cache.size>=500)cache.delete(cache.keys().next().value!);cache.set(place.id,{at:Date.now(),info});return info;}catch{return {};}})();
  pending.set(place.id,work);try{return await work;}finally{pending.delete(place.id);}
 }
 return async(places:KoreaRecord[],key=process.env.BOPok_TOURAPI_KEY??'')=>{const output:Record<string,Info>={};if(!key)return output;let next=0;const deadline=Date.now()+7000;await Promise.all(Array.from({length:4},async()=>{while(next<Math.min(places.length,20)&&Date.now()<deadline){const place=places[next++];if(place.nameKnown&&place.latitude!==null&&place.longitude!==null)output[place.id]=await lookup(place,key,deadline);}}));return output;};
}
export const fetchTourAPIDetails=createTourAPIEnricher();

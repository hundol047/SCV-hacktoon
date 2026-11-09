import {barrierFreeFacts} from '../domain/accessibility';
import type {Place} from '../data/demo';
export function createLodgingAccess(fetcher:typeof fetch=fetch){
 const cache=new Map<string,{at:number;facts:Place['facilities']}>();
 return async(id:string):Promise<Place['facilities']>=>{
  if(!/^\d{1,20}$/.test(id))return;
  const previous=cache.get(id);if(previous&&Date.now()-previous.at<6*3600000)return previous.facts;
  const key=process.env.BOPok_TOURAPI_ACCESSIBILITY_KEY||process.env.BOPok_TOURAPI_KEY;if(!key)return;
  try{const r=await fetcher('https://apis.data.go.kr/B551011/KorWithService2/detailWithTour2?'+new URLSearchParams({serviceKey:key,MobileOS:'ETC',MobileApp:'Yeohaengit',_type:'json',contentId:id}),{signal:AbortSignal.timeout(2000),redirect:'error'});if(!r.ok)return;const text=await r.text();if(text.length>200000)return;const data=JSON.parse(text)?.response;if(!['00','0000'].includes(String(data?.header?.resultCode)))return;const items=data.body?.items?.item,row=Array.isArray(items)?items[0]:items;if(!row||String(row.contentid)!==id)return;const facts=barrierFreeFacts(row,'tourapi:'+id,new Date().toISOString());if(cache.size>=500)cache.delete(cache.keys().next().value!);cache.set(id,{at:Date.now(),facts});return facts;}catch{return;}
 };
}
export const lodgingAccess=createLodgingAccess();

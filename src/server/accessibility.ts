import type {Catalog} from '../data/catalog';
import {barrierFreeFacts} from '../domain/accessibility';
import type {Place} from '../data/demo';
// Bounded on-demand enrichment; never send keys to the browser or store them in facts.
export function createAccessibilityEnricher(fetcher:typeof fetch=fetch){
 const cache=new Map<string,{at:number;facts:Place['facilities'];notes?:Place['accessNotes']}>();
 let date='',requests=0;
 return async(catalog:Catalog,key=process.env.BOPok_TOURAPI_ACCESSIBILITY_KEY||process.env.BOPok_TOURAPI_KEY||''):Promise<Catalog>=>{
  if(!key)return {...catalog,accessibilityLookup:{configured:false,failed:0,limited:false}};
  let failed=0,limited=false;
  const places=catalog.places.map(p=>({...p}));
  // Include meals, not only the first attractions in a region.
  const visits=places.filter(p=>p.kind==='visit'),others=places.filter(p=>p.kind!=='visit');
  const selected=Array.from({length:Math.max(visits.length,others.length)},(_,i)=>[visits[i],others[i]]).flat().filter((p):p is Place=>!!p&&/^tourapi:\d+$/.test(p.id)).slice(0,200);
  let next=0;
  await Promise.all(Array.from({length:8},async()=>{while(next<selected.length){
   const p=selected[next++],saved=cache.get(p.id);
   if(saved&&Date.now()-saved.at<6*3600000){p.facilities={...p.facilities,...saved.facts};p.accessNotes=saved.notes;continue;}
   const today=new Date().toISOString().slice(0,10);if(date!==today){date=today;requests=0;}if(requests>=1000){limited=true;break;}requests++;
   try{
    const query=new URLSearchParams({serviceKey:key,MobileOS:'ETC',MobileApp:'Yeohaengit',_type:'json',contentId:p.id.split(':')[1]});
    const r=await fetcher('https://apis.data.go.kr/B551011/KorWithService2/detailWithTour2?'+query,{signal:AbortSignal.timeout(2500),redirect:'error'});
    if(!r.ok){failed++;continue;}const text=await r.text();if(text.length>200000)continue;
    const data=JSON.parse(text)?.response;if(!['00','0000'].includes(String(data?.header?.resultCode))){failed++;continue;}
    const items=data?.body?.items?.item,row=Array.isArray(items)?items[0]:items;
    if(!row||String(row.contentid)!==p.id.split(':')[1])continue;
    const at=new Date().toISOString();const clean=(v:unknown)=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').trim().slice(0,2000):'';
    const notes={entry:clean(row.exit),route:clean(row.route),parking:clean(row.parking),toilet:clean(row.restroom),source:'https://apis.data.go.kr/B551011/KorWithService2/detailWithTour2',collectedAt:at};
    const facts=barrierFreeFacts(row,p.id,at);p.accessNotes=notes;
    p.facilities={...p.facilities,...facts};
    if(cache.size>=1000)cache.delete(cache.keys().next().value!);cache.set(p.id,{at:Date.now(),facts,notes});
   }catch{failed++;/* Keep unknown as unknown; the strict recommendation filter remains active. */}
  }}));return {...catalog,places,accessibilityLookup:{configured:true,failed,limited}};
 };
}
export const enrichAccessibility=createAccessibilityEnricher();

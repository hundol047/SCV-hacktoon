import type {Place} from '../data/demo';
import {fetchPlaceDetails} from './place-details';
import {tourInfo} from './tourapi-details';
import {enrichOpening} from './opening-enrichment';
export async function plannedDetails(places:Place[],fetcher:typeof fetch=fetch){
 const osm=await fetchPlaceDetails(places.filter(p=>p.id.startsWith('osm:')).map(p=>p.id),fetcher);
 const output=places.map(p=>osm[p.id]?enrichOpening(p,osm[p.id],'https://www.openstreetmap.org'):p);
 const key=process.env.BOPok_TOURAPI_KEY;if(!key)return output;
 let next=0;const deadline=Date.now()+7000;
 async function get(op:string,args:Record<string,string>){const response=await fetcher('https://apis.data.go.kr/B551011/KorService2/'+op+'?'+new URLSearchParams({serviceKey:key!,MobileOS:'ETC',MobileApp:'Yeohaengit',_type:'json',...args}),{signal:AbortSignal.timeout(Math.max(1,Math.min(3000,deadline-Date.now()))),redirect:'error'});if(!response.ok)throw Error();const text=await response.text();if(text.length>200000)throw Error();const data=JSON.parse(text)?.response;const rows=data?.body?.items?.item;return Array.isArray(rows)?rows[0]:rows;}
 await Promise.all(Array.from({length:3},async()=>{while(next<output.length&&Date.now()<deadline){const i=next++,p=output[i];if(!/^tourapi:\d+$/.test(p.id))continue;try{const contentId=p.id.split(':')[1];const basic=await get('detailCommon2',{contentId});if(!basic)continue;const intro=await get('detailIntro2',{contentId,contentTypeId:String(basic.contenttypeid??(p.kind==='meal'?'39':'12'))});output[i]=enrichOpening(p,tourInfo(basic,intro??{}),'https://apis.data.go.kr/B551011/KorService2/detailIntro2');}catch{}}}));
 return output;
}

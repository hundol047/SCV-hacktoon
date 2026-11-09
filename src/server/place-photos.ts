import {placePhotoURL} from '../domain/place-photo';
let quotaDay='',requests=0;
const cache=new Map<string,{at:number;imageUrl?:string}>();
export async function officialPlacePhotos(ids:string[],fetcher:typeof fetch=fetch,key=process.env.BOPok_TOURAPI_KEY??''){
 const photos:Record<string,{imageUrl:string}>={};if(!key)return photos;let next=0;const selected=[...new Set(ids)].filter(id=>/^tourapi:[1-9]\d{0,14}$/.test(id)).slice(0,20),deadline=Date.now()+6000;
 await Promise.all(Array.from({length:4},async()=>{while(next<selected.length&&Date.now()<deadline){const id=selected[next++],saved=cache.get(id);if(saved&&Date.now()-saved.at<21600000){if(saved.imageUrl)photos[id]={imageUrl:saved.imageUrl};continue;}
 try{const today=new Date().toISOString().slice(0,10);if(quotaDay!==today){quotaDay=today;requests=0;}if(requests>=1000)return;requests++;const response=await fetcher('https://apis.data.go.kr/B551011/KorService2/detailCommon2?'+new URLSearchParams({serviceKey:key,MobileOS:'ETC',MobileApp:'Yeohaengit',_type:'json',contentId:id.split(':')[1]}),{signal:AbortSignal.timeout(Math.max(1,Math.min(2000,deadline-Date.now()))),redirect:'error'});if(!response.ok)continue;const body=await response.text();if(body.length>300000)continue;const raw=JSON.parse(body)?.response;const rows=raw?.body?.items?.item;const row=Array.isArray(rows)?rows[0]:rows;if(!['00','0000'].includes(String(raw?.header?.resultCode))||String(row?.contentid)!==id.split(':')[1])continue;const imageUrl=placePhotoURL(row.firstimage||row.firstimage2);if(cache.size>=1000)cache.delete(cache.keys().next().value!);cache.set(id,{at:Date.now(),imageUrl});if(imageUrl)photos[id]={imageUrl};}catch{/* Missing photos do not block the itinerary. */}
 }}));return photos;
}

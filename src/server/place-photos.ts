import {placePhotoURL} from '../domain/place-photo';
export type PlacePhotos={imageUrl:string;imageUrls:string[]};
export function createOfficialPlacePhotos(){
 let quotaDay='',requests=0;
 const cache=new Map<string,{at:number;photos?:PlacePhotos}>();const pending=new Map<string,Promise<PlacePhotos|undefined>>();
 return async function photos(ids:string[],fetcher:typeof fetch=fetch,key=process.env.BOPok_TOURAPI_KEY??''){
  const output:Record<string,PlacePhotos>={};if(!key)return output;
  const selected=[...new Set(ids)].filter(id=>/^tourapi:[1-9]\d{0,14}$/.test(id)).slice(0,20);let next=0;
  async function lookup(id:string){
   const saved=cache.get(id);if(saved&&Date.now()-saved.at<(saved.photos?21600000:60000))return saved.photos;
   if(pending.has(id))return pending.get(id)!;
   const work=(async()=>{
    const contentId=id.split(':')[1];let complete=true;
    async function get(operation:string,params:Record<string,string>){
     const today=new Date().toISOString().slice(0,10);if(quotaDay!==today){quotaDay=today;requests=0;}if(requests>=1000)throw Error('Photo lookup limit');requests++;
     const response=await fetcher('https://apis.data.go.kr/B551011/KorService2/'+operation+'?'+new URLSearchParams({serviceKey:key,MobileOS:'ETC',MobileApp:'Yeohaengit',_type:'json',contentId,numOfRows:'10',pageNo:'1',...params}),{signal:AbortSignal.timeout(2500),redirect:'error'});
     if(!response.ok)throw Error('Photo provider unavailable');const body=await response.text();if(body.length>500000)throw Error('Photo response too large');const raw=JSON.parse(body)?.response;if(!['00','0000'].includes(String(raw?.header?.resultCode)))throw Error('Photo provider rejected request');const value=raw?.body?.items?.item;return (Array.isArray(value)?value:value&&typeof value==='object'?[value]:[]).filter((row:Record<string,unknown>)=>row&&(!row.contentid||String(row.contentid)===contentId));
    }
    const [common,gallery]=await Promise.all([
     get('detailCommon2',{defaultYN:'Y',firstImageYN:'Y'}).catch(()=>{complete=false;return [];}),
     get('detailImage2',{imageYN:'Y',subImageYN:'Y'}).catch(()=>{complete=false;return [];})
    ]);
    const imageUrls=[...new Set<string>([...common.flatMap((r:Record<string,unknown>)=>[r.firstimage,r.firstimage2]),...gallery.flatMap((r:Record<string,unknown>)=>[r.originimgurl,r.smallimageurl])].map(placePhotoURL).filter((s):s is string=>!!s))].slice(0,8);
    const result=imageUrls.length?{imageUrl:imageUrls[0],imageUrls}:undefined;
    if(complete||result){if(cache.size>=1000)cache.delete(cache.keys().next().value!);cache.set(id,{at:Date.now(),photos:result});}return result;
   })();pending.set(id,work);try{return await work;}finally{pending.delete(id);}
  }
  await Promise.all(Array.from({length:4},async()=>{while(next<selected.length){const id=selected[next++];const result=await lookup(id);if(result)output[id]=result;}}));return output;
 };
}
export const officialPlacePhotos=createOfficialPlacePhotos();

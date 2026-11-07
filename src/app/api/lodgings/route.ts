import {planningQuota} from '../../../server/planning-quota';
import {z} from 'zod';
import {sameOrigin,json,readJSON} from '../../../server/security';
import {currentPointSchema} from '../../../server/reverse-location';
import {haversineKm} from '../../../domain/taxi-plan';
import {lodgingSchema,lodgingImage} from '../../../domain/lodging';
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'잘못된 요청입니다.'},403);try{await planningQuota(request);const point=currentPointSchema.parse(await readJSON(request,1000));const key=process.env.BOPok_TOURAPI_KEY;if(!key)return json({error:'숙소 추천 연결이 준비되지 않았습니다. 지역 숙소 검색 링크를 이용하세요.'},503);
 const response=await fetch('https://apis.data.go.kr/B551011/KorService2/locationBasedList2?'+new URLSearchParams({serviceKey:key,MobileOS:'ETC',MobileApp:'Yeohaengit',_type:'json',mapX:String(point.longitude),mapY:String(point.latitude),radius:'10000',contentTypeId:'32',numOfRows:'30',pageNo:'1',arrange:'E'}),{signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store'});if(!response.ok)throw Error();const text=await response.text();if(text.length>1000000)throw Error();const data=JSON.parse(text)?.response;if(!['00','0000'].includes(String(data?.header?.resultCode)))throw Error();const raw=data.body?.items?.item;const rows=Array.isArray(raw)?raw:raw?[raw]:[];
 const hotels=rows.flatMap(r=>{const parsed=lodgingSchema.safeParse({id:String(r.contentid),name:String(r.title??'').slice(0,300),address:String(r.addr1??'').slice(0,1000),latitude:Number(r.mapy),longitude:Number(r.mapx),imageUrl:lodgingImage(r.firstimage)||lodgingImage(r.firstimage2),distanceKm:haversineKm(point,{latitude:Number(r.mapy),longitude:Number(r.mapx)})});return parsed.success&&parsed.data.name&&parsed.data.distanceKm<=10?[parsed.data]:[];}).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,6);
 return json({hotels,fetchedAt:new Date().toISOString()});}catch{return json({error:'숙소 정보를 불러오지 못했습니다. 가격 비교 사이트에서 지역으로 검색해 주세요.'},502);}}

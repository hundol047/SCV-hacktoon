import {z} from 'zod';
import {tourEvents} from '../../../adapters/events';
import {json} from '../../../server/security';
const cache=new Map<string,{at:number;data:ReturnType<typeof tourEvents>}>();
export async function GET(request:Request){
  const p=new URL(request.url).searchParams;
  const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;});
  const input=z.object({start:date,end:date,page:z.coerce.number().int().min(1).max(100)}).safeParse({start:p.get('start'),end:p.get('end'),page:p.get('page')??1});
  if(!input.success||input.data.start>input.data.end)return json({error:'올바른 조회 기간을 선택하세요.'},400);
  const key=process.env.BOPok_TOURAPI_KEY;if(!key)return json({error:'공식 행사 API가 미설정입니다. 출처가 있는 행사 등록·JSON 가져오기는 사용할 수 있습니다.'},503);
  const {start,end,page}=input.data,cacheKey=[start,end,page].join('|'),hit=cache.get(cacheKey);if(hit&&Date.now()-hit.at<300000)return json(hit.data);
  try{const url=new URL('https://apis.data.go.kr/B551011/KorService2/searchFestival2');url.search=new URLSearchParams({serviceKey:key,MobileOS:'ETC',MobileApp:'Bopok',_type:'json',eventStartDate:start.replaceAll('-',''),eventEndDate:end.replaceAll('-',''),numOfRows:'50',pageNo:String(page),arrange:'A'}).toString();const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();const data=tourEvents(await response.json());if(cache.size>=20)cache.delete(cache.keys().next().value!);cache.set(cacheKey,{at:Date.now(),data});return json(data);}catch{return json({error:'공식 행사 자료를 가져오지 못했습니다. 인증·쿼터·공급자 상태를 확인하세요. 기존 자료는 유지됩니다.'},502);}
}

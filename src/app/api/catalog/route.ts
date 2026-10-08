import {appURL,quotaLimit} from '../../../server/config';
import {z} from 'zod';
import {measure} from '../../../server/metrics';
import {TransitProvider} from '../../../adapters/transit';
import {OpenRouteProvider} from '../../../adapters/real-data';
import {catalogSchema} from '../../../data/catalog';
import {configuredRPC,TripStore,StoreError} from '../../../server/store';
import {hash,ownerOf,capabilityOf,sameOrigin,json,readJSON,InputError} from '../../../server/security';
import {loadCatalog} from '../../../server/catalog';
import {koreaRoutePlaces} from '../../../server/korea-tourism';
const region=z.string().trim().min(1).max(120);
function failure(e:unknown){if(e instanceof InputError||e instanceof z.ZodError)return json({error:e instanceof InputError&&e.status===413?'조회 요청이 너무 큽니다.':'조회 요청 형식을 확인해 주세요.'},e instanceof InputError?e.status:400);if(e instanceof StoreError&&e.code==='capacity')return json({error:'공유 자료 캐시 한도에 도달했습니다. 잠시 후 다시 조회해 주세요.'},429);return json({error:e instanceof StoreError&&e.code==='busy'?'공급자 요청 간격을 지키고 있습니다. 잠시 후 다시 조회해 주세요.':'실제 정보를 확인하지 못했습니다. 연결·공급자 상태를 확인해 주세요. 미확인 값을 0이나 가상 장소로 대체하지 않았습니다.'},e instanceof StoreError&&e.code==='busy'?429:502);}
export async function GET(request:Request){const query=region.safeParse(new URL(request.url).searchParams.get('region'));if(!query.success)return json({error:'도시와 국가를 1~120자로 입력해 주세요.'},400);
 const applicationURL=appURL(),rpc=configuredRPC();if(!applicationURL||!rpc)return json({error:'실제 도시 검색에는 공개 앱 주소와 공유 캐시 저장소 설정이 필요합니다.'},503);
 try{const params=new URL(request.url).searchParams,limit=z.coerce.number().int().min(10).max(200).parse(params.get('limit')??30),radius=z.coerce.number().min(1).max(50).parse(params.get('radius')??10)*1000;return json(await loadCatalog(rpc,query.data,applicationURL,false,limit,radius));}catch(e){return failure(e);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
 const owner=ownerOf(request),rpc=configuredRPC();if(!owner||!rpc)return json({error:'실제 정보 조회에는 서버 세션·저장소 설정이 필요합니다.'},503);
 try{
 const body=z.discriminatedUnion('action',[
  z.object({action:z.literal('refresh'),region,limit:z.number().int().min(10).max(200).default(30),radius:z.number().min(1000).max(50000).default(10000)}),
  z.object({action:z.literal('route'),region,cacheKey:z.string().regex(/^catalog:[a-f0-9]{64}$/).optional(),fromId:z.string().min(1).max(100),toId:z.string().min(1).max(100),transport:z.enum(['taxi','walk','driving','transit']),departureAt:z.string().datetime().optional(),tripId:z.string().max(100).optional(),cloudId:z.string().uuid().optional()})
 ]).parse({action:'route',...await readJSON(request,10000)});
 const store=new TripStore(rpc);
 if(body.action==='refresh'){
  if(!appURL())return json({error:'공개 앱 주소 설정이 필요합니다.'},503);
  if(!(await store.reserve(hash('refresh:'+owner),{scope:'refresh',minuteLimit:3,dailyRequests:quotaLimit('BOPok_REFRESH_DAILY_LIMIT',100)})).allowed)return json({error:'장소 갱신 한도에 도달했습니다.'},429);
  return json(await loadCatalog(rpc,body.region,appURL()!,true,body.limit,body.radius));
 }
 const key=body.transport==='transit'?process.env.BOPok_GOOGLE_MAPS_KEY:process.env.BOPok_ROUTE_KEY;if(!key)return json({error:'경로 공급자 인증 설정이 필요합니다.'},503);
 if(!(await store.reserve(hash('route:'+owner),{scope:'route',minuteLimit:5,dailyRequests:quotaLimit('BOPok_ROUTE_DAILY_LIMIT',1000)})).allowed)return json({error:'경로 조회 한도에 도달했습니다.'},429);
 const cached=await rpc.call('bopok_cache',{p_key:body.cacheKey??'catalog:'+hash(body.region)});let catalog=cached?catalogSchema.parse(cached):null;
 if(!catalog||!catalog.places.some(p=>p.id===body.fromId)||!catalog.places.some(p=>p.id===body.toId)){
  try{const stored=body.cloudId?await store.get(owner,body.cloudId,capabilityOf(request)):body.tripId?await store.action('find',owner,undefined,'',{id:body.tripId}):null;
   if(stored?.trip?.catalog&&(stored.trip.catalog.region===body.region||stored.trip.catalog.cities?.some((c:any)=>c.region===body.region)))catalog=catalogSchema.parse(stored.trip.catalog);
  }catch{/* A local trip can still refresh the shared city catalog. */}
  if(!catalog||!catalog.places.some(p=>p.id===body.fromId)||!catalog.places.some(p=>p.id===body.toId)){
   const local=await koreaRoutePlaces([body.fromId,body.toId],body.region);
   if(local)catalog={mode:'real',region:body.region,places:local,routes:[],sourceNotice:'전국 OSM 수집 자료',collectedAt:null};
  }
  if(!catalog&&appURL())catalog=await loadCatalog(rpc,body.region,appURL()!);
 }
 const from=catalog?.places.find(p=>p.id===body.fromId),to=catalog?.places.find(p=>p.id===body.toId);if(!from||!to)return json({error:'출발·도착 후보가 최신 자료에 없습니다. 실제 장소 자료를 갱신하고 후보를 다시 선택해 주세요.'},400);
 if(body.transport==='transit'){if(!body.departureAt)return json({error:'대중교통은 현지 출발 시각이 필요합니다.'},400);return json(await measure('routing',()=>new TransitProvider(key).route(from,to,body.departureAt!),rpc));}return json(await measure('routing',()=>new OpenRouteProvider(key).route(from,to,body.transport as 'walk'|'taxi'|'driving'),rpc));
 }catch(e){if(e instanceof z.ZodError)return json({error:'조회 요청 형식을 확인해 주세요.'},400);return failure(e);}
}

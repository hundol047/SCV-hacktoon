import {z} from 'zod';
import {OpenMapProvider,OpenRouteProvider} from '../../../adapters/real-data';
import {catalogSchema} from '../../../data/catalog';
import {configuredRPC,TripStore} from '../../../server/store';
import {hash,ownerOf,sameOrigin,json,readJSON} from '../../../server/security';
export async function GET(request:Request){const query=new URL(request.url).searchParams.get('region')?.trim();if(!query||query.length>120)return json({error:'도시와 국가를 1~120자로 입력해 주세요.'},400);
  const appURL=process.env.BOPok_APP_URL,rpc=configuredRPC();if(!appURL||!rpc)return json({error:'실제 도시 검색에는 공개 앱 주소와 공유 캐시 저장소 설정이 필요합니다. 실제·가상 자료를 자동으로 섞지 않습니다.'},503);
  try{const cacheKey='catalog:'+hash(query),cached=await rpc.call('bopok_cache',{p_key:cacheKey});if(cached)return json(catalogSchema.parse(cached));
    if(!(await rpc.call('bopok_geo_guard',{p_provider:'nominatim'})).allowed||!(await rpc.call('bopok_geo_guard',{p_provider:'overpass'})).allowed)return json({error:'공급자 요청 간격을 지키고 있습니다. 잠시 후 검색해 주세요.'},429);
    const provider=new OpenMapProvider(appURL),location=await provider.location(query),catalog=await provider.places(query,location);await rpc.call('bopok_cache',{p_key:cacheKey,p_value:catalog});return json(catalog);
  }catch{return json({error:'실제 장소를 조회하지 못했습니다. 연결·공급자 상태를 확인해 주세요. 가상 장소로 대체하지 않았습니다.'},502);}
}
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);const owner=ownerOf(request),rpc=configuredRPC(),key=process.env.BOPok_ROUTE_KEY;if(!owner||!rpc||!key)return json({error:'경로 조회에는 서버 세션·저장소·경로 공급자 인증 설정이 필요합니다.'},503);
  try{const body=z.object({region:z.string().min(1).max(120),fromId:z.string(),toId:z.string(),transport:z.enum(['taxi','walk'])}).parse(await readJSON(request,10000));const cached=await rpc.call('bopok_cache',{p_key:'catalog:'+hash(body.region)});const catalog=catalogSchema.parse(cached);const from=catalog.places.find(p=>p.id===body.fromId),to=catalog.places.find(p=>p.id===body.toId);if(!from||!to)return json({error:'서버가 조회한 실제 후보에서 출발·도착지를 선택해 주세요.'},400);
    if(!(await new TripStore(rpc).reserve(hash('route:'+owner),{scope:'route',minuteLimit:5,dailyRequests:1000})).allowed)return json({error:'경로 조회 한도에 도달했습니다.'},429);
    return json(await new OpenRouteProvider(key).route(from,to,body.transport));
  }catch{return json({error:'경로 정보를 확인하지 못했습니다. 시간·거리·계단을 0으로 대체하지 않았습니다.'},502);}
}

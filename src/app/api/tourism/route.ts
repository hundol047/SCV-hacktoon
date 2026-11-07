import {enrichAccessibility} from '../../../server/accessibility';
import {officialCatalog} from '../../../server/tourapi-catalog';
import {matchingProvince} from '../../../data/korea-catalog';
import {koreaStats} from '../../../data/korea-catalog';
import {z} from 'zod';
import {koreaRegions,koreaCategories,type KoreaCategory} from '../../../data/korea-tourism';
import {readKoreaSnapshot,searchKorea,koreaCatalog} from '../../../server/korea-tourism';
import {json} from '../../../server/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams;
  const action=z.enum(['search','catalog']).parse(params.get('action')??'search');
  const query=z.string().trim().max(120).parse(params.get('q')??'');
  const province=z.enum(['',...koreaRegions.map(r=>r.code)]).parse(params.get('province')??'');
  const category=z.enum(['',...Object.keys(koreaCategories)] as ['',...KoreaCategory[]]).parse(params.get('category')??'');
  const page=z.coerce.number().int().min(1).max(100000).parse(params.get('page')??1);
  const limit=z.coerce.number().int().min(action==='catalog'?10:1).max(action==='catalog'?200:100).parse(params.get('limit')??(action==='catalog'?200:25));
  const snapshot=await readKoreaSnapshot();
  if(action==='catalog'){const code=province||matchingProvince(snapshot,query);if(!code||!query&&!province)return json({error:'여행할 시·군·구를 입력해 주세요.'},400);const catalog=await officialCatalog(koreaCatalog(snapshot,code,query,limit),code,query);return json(params.get('accessibility')==='true'?await enrichAccessibility(catalog):catalog);}
  return json({...searchKorea(snapshot,query,province,category,page,limit),dataset:{total:snapshot.records.length,collectedAt:snapshot.collectedAt,coverage:snapshot.coverage,license:snapshot.license,attribution:snapshot.attribution,stale:Date.now()-Date.parse(snapshot.collectedAt)>7*86400000,...koreaStats(snapshot),notice:'© OpenStreetMap 기여자 · 운영시간과 현장 정보는 방문 전 확인해 주세요.'}});
 }catch(e){return json({error:e instanceof z.ZodError?'검색 조건을 확인해 주세요.':'전국 관광 자료를 읽지 못했습니다. 데이터 수집·무결성 상태를 확인해 주세요.'},e instanceof z.ZodError?400:503);}
}

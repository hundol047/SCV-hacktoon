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
  if(action==='catalog'&&!province)return json({error:'일정 후보에는 한 시·도를 선택해 주세요.'},400);
  const snapshot=await readKoreaSnapshot();
  if(action==='catalog')return json(koreaCatalog(snapshot,province,query,limit));
  return json({...searchKorea(snapshot,query,province,category,page,limit),dataset:{total:snapshot.records.length,collectedAt:snapshot.collectedAt,coverage:snapshot.coverage,license:snapshot.license,attribution:snapshot.attribution,stale:Date.now()-Date.parse(snapshot.collectedAt)>7*86400000,missingNames:snapshot.records.filter(r=>!r.nameKnown).length,missingCoordinates:snapshot.records.filter(r=>r.latitude===null||r.longitude===null).length,missingAddresses:snapshot.records.filter(r=>!r.address.trim()).length,notice:'17개 지역 구획 OSM 등록 자료입니다. 지도 미등록 장소·축제·운영정보의 전수 수집이 아닙니다. 이름·좌표 미등록 항목도 목록에 포함합니다.'}});
 }catch(e){return json({error:e instanceof z.ZodError?'검색 조건을 확인해 주세요.':'전국 관광 자료를 읽지 못했습니다. 데이터 수집·무결성 상태를 확인해 주세요.'},e instanceof z.ZodError?400:503);}
}

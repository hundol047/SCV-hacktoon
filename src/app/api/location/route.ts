import {z} from 'zod';
import {sameOrigin,json,readJSON} from '../../../server/security';
import {configuredRPC} from '../../../server/store';
import {searchLocation,LocationSearchError} from '../../../server/location-search';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
 try{const {query}=z.object({query:z.string().trim().min(2).max(200)}).parse(await readJSON(request,2000));const rpc=configuredRPC();if(!rpc)return json({error:'주소 검색 연결 설정을 확인해 주세요.'},503);const locations=await searchLocation(query,rpc);return json({locations});}
 catch(e){if(e instanceof z.ZodError)return json({error:'학교명·장소명 또는 상세주소를 2자 이상 입력해 주세요.'},400);if(e instanceof LocationSearchError&&e.code==='BUSY')return json({error:'주소 검색이 진행 중입니다. 2초 후 다시 시도해 주세요.'},429);return json({error:'주소 검색에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},502);}
}

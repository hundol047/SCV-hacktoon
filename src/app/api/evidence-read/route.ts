import {z} from 'zod';
import {bedrockConfigured} from '../../../server/bedrock';
import {readEvidenceImage} from '../../../server/evidence-reader';
import {reserveAI} from '../../../server/ai-budget';
import {sameOrigin,json,readJSON} from '../../../server/security';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
 const input=z.object({kind:z.enum(['receipt','visit']),image:z.string().min(8).max(2800000).regex(/^[A-Za-z0-9+/]+={0,2}$/),consent:z.literal(true)}).safeParse(await readJSON(request,2900000).catch(()=>null));
 if(!input.success)return json({error:'사진 형식과 AI 전송 동의를 확인하세요.'},400);
 const bytes=Buffer.from(input.data.image,'base64');if(bytes.length>2*1024*1024||bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return json({error:'2MB 이하 JPEG 읽기용 사진이 필요해요.'},400);
 if(!bedrockConfigured())return json({error:'AI 사진 읽기 연결을 확인하세요. 사진은 저장되어 있으니 직접 내용을 입력할 수 있어요.'},503);
 try{const gate=await reserveAI(request);if(!gate.allowed)return json({error:gate.message},429);const reading=await readEvidenceImage(bytes,input.data.kind);const response=json({reading});if(gate.cookie)response.headers.set('Set-Cookie',gate.cookie);return response;}catch{return json({error:'사진 내용을 읽지 못했어요. 직접 입력하거나 다시 읽기를 눌러 주세요.'},502);}
}

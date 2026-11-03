import {bedrockConfigured,converseJSON} from '../../../server/bedrock';
import {z} from 'zod';
import {promotionInputSchema,promotionReplySchema,promotionInstructions} from '../../../domain/promotion';
import {reserveAI} from '../../../server/ai-budget';
import {sameOrigin,json,readJSON} from '../../../server/security';
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
  const parsed=z.object({input:promotionInputSchema,consent:z.literal(true)}).safeParse(await readJSON(request,16000).catch(()=>null));
  if(!parsed.success)return json({error:'상호·지역·업종·확인된 사실과 전송 동의를 확인하세요.'},400);
  if(!bedrockConfigured())return json({error:'서버 AWS 리전과 EC2 IAM 역할 설정을 확인해 주세요.'},503);
  try{const gate=await reserveAI(request);if(!gate.allowed)return json({error:gate.message},429);const schema=z.toJSONSchema(promotionReplySchema);delete schema.$schema;
    const raw=await converseJSON(promotionInstructions,JSON.stringify(parsed.data.input),schema,'promotion',1600);const output=promotionReplySchema.parse(raw);const response=json(output);if(gate.cookie)response.headers.set('Set-Cookie',gate.cookie);return response;
  }catch{return json({error:'AI 홍보 초안을 만들지 못했습니다. 기본 초안을 사용하거나 연결을 확인하세요.'},502);}
}

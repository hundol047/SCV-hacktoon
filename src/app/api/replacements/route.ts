import {bedrockConfigured,converseJSON} from '../../../server/bedrock';
import {z} from 'zod';
import {tripSchema} from '../../../domain/schema';
import {replacementInput,replacementInstructions,replacementReplySchema,validateReplacements} from '../../../domain/replacements';
import {reserveAI} from '../../../server/ai-budget';
import {sameOrigin,json,readJSON} from '../../../server/security';
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
  try{
    const {trip,itemId}=z.object({trip:tripSchema,itemId:z.string().min(1),consent:z.literal(true)}).parse(await readJSON(request));
    const input=replacementInput(trip,itemId);
    if(!bedrockConfigured())return json({error:'서버 AWS 리전과 EC2 IAM 역할 설정을 확인해 주세요.'},503);
    const gate=await reserveAI(request);if(!gate.allowed)return json({error:gate.message},429);
    const schema=z.toJSONSchema(replacementReplySchema);delete schema.$schema;
    const raw=await converseJSON(replacementInstructions,input.text,schema,'replacement',800);
    const result=replacementReplySchema.parse(raw);validateReplacements(trip,itemId,result);
    const response=json(result);if(gate.cookie)response.headers.set('Set-Cookie',gate.cookie);return response;
  }catch{return json({error:'추천을 완료하지 못했습니다. 기존 일정은 유지됩니다. 후보와 AI 연결을 확인해 주세요.'},502);}
}

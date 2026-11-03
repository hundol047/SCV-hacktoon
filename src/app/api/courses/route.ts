import {bedrockConfigured,converseJSON} from '../../../server/bedrock';
import {z} from 'zod';
import {basicsSchema,conditionsSchema} from '../../../domain/schema';
import {courseInput,courseInstructions,courseReplySchema,regionalCourse} from '../../../domain/regional-course';
import {catalogSchema} from '../../../data/catalog';
import {reserveAI} from '../../../server/ai-budget';
import {sameOrigin,json,readJSON} from '../../../server/security';
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
  try{
    const {basics,conditions,catalog,day}=z.object({basics:basicsSchema,conditions:conditionsSchema,catalog:catalogSchema,day:z.number().int().min(1).max(30),consent:z.literal(true)}).parse(await readJSON(request));
    const input=courseInput(basics,conditions,catalog,day);
    if(!bedrockConfigured())return json({error:'서버 AWS 리전과 EC2 IAM 역할 설정을 확인해 주세요.'},503);
    const gate=await reserveAI(request);if(!gate.allowed)return json({error:gate.message},429);
    const schema=z.toJSONSchema(courseReplySchema);delete schema.$schema;
    const raw=await converseJSON(courseInstructions,input.text,schema,'course',800);
    const result=courseReplySchema.parse(raw);regionalCourse(basics,conditions,catalog,day,result);
    const response=json(result);if(gate.cookie)response.headers.set('Set-Cookie',gate.cookie);return response;
  }catch{return json({error:'추천을 완료하지 못했습니다. 기존 일정은 유지됩니다. 후보와 AI 연결을 확인해 주세요.'},502);}
}

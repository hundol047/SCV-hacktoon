import {batchInput,batchReplySchema,validateBatch} from '../../../domain/course-batch';
import {bedrockConfigured,converseJSON,BedrockReplyError} from '../../../server/bedrock';
import {z} from 'zod';
import {basicsSchema,conditionsSchema} from '../../../domain/schema';
import {courseInput,courseInstructions,courseReplySchema,regionalCourse} from '../../../domain/regional-course';
import {catalogSchema} from '../../../data/catalog';
import {reserveAI} from '../../../server/ai-budget';
import {sameOrigin,json,readJSON} from '../../../server/security';
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
  let stage='request';
  try{
    const {basics,conditions,catalog,day,allDays}=z.object({basics:basicsSchema,conditions:conditionsSchema,catalog:catalogSchema,day:z.number().int().min(1).max(30),consent:z.literal(true),allDays:z.boolean().optional()}).parse(await readJSON(request));
    stage='candidates';
    const input=allDays?{text:batchInput(basics,conditions,catalog)}:courseInput(basics,conditions,catalog,day);
    if(!bedrockConfigured())return json({error:'서버 AWS 리전과 EC2 IAM 역할 설정을 확인해 주세요.'},503);
    const gate=await reserveAI(request);if(!gate.allowed)return json({error:gate.message},429);
    const schema=z.toJSONSchema(allDays?batchReplySchema:courseReplySchema);delete schema.$schema;
    stage='model';
    const raw=await converseJSON(allDays?courseInstructions.replace('Return candidateIds only.','')+' Plan all supplied days in one response as {days:[{day,candidateIds}]}. Choose up to maxAttractions for each day, aiming for four in morning trips and three in afternoon trips; reserve at least two unused attractions for every remaining day. Never repeat an attraction across days. Respect the candidate list and weather for each day.':courseInstructions,input.text,schema,'course',1600);
    stage='validation';
    const result=allDays?validateBatch(basics,conditions,catalog,raw).reply:courseReplySchema.parse(raw);if(!allDays)regionalCourse(basics,conditions,catalog,day,result);
    const response=json(result);if(gate.cookie)response.headers.set('Set-Cookie',gate.cookie);return response;
  }catch(e){
    if(stage==='request')return json({error:'일정 입력 형식을 확인해 주세요.',code:'COURSE_INPUT'},400);
    if(stage==='candidates')return json({error:e instanceof Error?e.message:'추천할 관광지 자료가 부족합니다.',code:'COURSE_CANDIDATES'},422);
    const name=e instanceof Error?e.name:'';
    const code=stage==='validation'?'AI_INVALID_CANDIDATES':e instanceof BedrockReplyError?e.code:name==='ValidationException'?'AI_REQUEST_REJECTED':name==='AccessDeniedException'?'AI_ACCESS_DENIED':name==='ThrottlingException'?'AI_BUSY':name==='TimeoutError'||name==='AbortError'?'AI_TIMEOUT':'AI_CALL_FAILED';
    // No prompts, credentials, provider response bodies or candidate data in logs.
    console.error('course_generation_failed',{stage,code});
    const message:Record<string,string>={AI_OUTPUT_LIMIT:'AI 답변이 길이 제한으로 중단됐습니다.',AI_TIMEOUT:'AI 응답 시간이 초과됐습니다.',AI_BUSY:'AI 요청이 몰렸습니다. 잠시 후 다시 시도해 주세요.',AI_REQUEST_REJECTED:'AI 서버가 요청 형식을 거절했습니다.',AI_ACCESS_DENIED:'서버의 모델 호출 권한을 확인해 주세요.',AI_INVALID_CANDIDATES:'AI가 유효한 관광지 목록을 반환하지 않았습니다.',AI_INVALID_JSON:'AI 답변 형식을 읽지 못했습니다.'};
    return json({error:`${message[code]??'AI 응답을 완료하지 못했습니다.'} 기존 일정은 유지됩니다. (${code})`,code},502);
  }
}

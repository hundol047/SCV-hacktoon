import {voiceRequestSchema} from '../../../domain/voice-ai';
import {interpretVoice} from '../../../server/voice-intent';
import {bedrockConfigured} from '../../../server/bedrock';
import {reserveAI} from '../../../server/ai-budget';
import {sameOrigin,json,readJSON} from '../../../server/security';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
 const parsed=voiceRequestSchema.safeParse(await readJSON(request,18000).catch(()=>null));if(!parsed.success)return json({error:'말씀하신 내용과 여행 조건을 확인해 주세요.'},400);
 if(!bedrockConfigured())return json({error:'AI 음성 해석 연결이 준비되지 않았어요. 직접 입력하거나 잠시 후 다시 시도해 주세요.'},503);
 try{const gate=await reserveAI(request);if(!gate.allowed)return json({error:gate.message},429);const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());const result=await interpretVoice(parsed.data.text,parsed.data.context,parsed.data.history,today);const response=json({result,provider:'bedrock'});if(gate.cookie)response.headers.set('Set-Cookie',gate.cookie);return response;}catch{return json({error:'AI가 말씀을 해석하지 못했어요. 입력한 조건은 유지됩니다. 짧게 나눠 말하거나 다시 해석해 주세요.'},502);}
}

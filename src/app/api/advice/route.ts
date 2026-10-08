import {z} from 'zod';
import {tripSchema} from '../../../domain/schema';
import {adviceInput,requestAdvice} from '../../../adapters/advice';
import {reserveAI} from '../../../server/ai-budget';
import {sameOrigin,json,readJSON} from '../../../server/security';
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);try{const {trip}=z.object({trip:tripSchema,consent:z.literal(true)}).parse(await readJSON(request));adviceInput(trip);const key=process.env.BOPok_AI_KEY,model=process.env.BOPok_AI_MODEL;if(!key||!model)return json({error:'AI 설명은 아직 연결되지 않았습니다. 화면의 규칙 점검 결과를 사용할 수 있습니다.'},503);const gate=await reserveAI(request);if(!gate.allowed)return json({error:gate.message},429);const response=json({...await requestAdvice(trip,key,model),usage:gate.usage});if(gate.cookie)response.headers.set('Set-Cookie',gate.cookie);return response;}catch{return json({error:'AI 설명을 가져오지 못했습니다. 일정은 유지됩니다. 규칙 점검 결과를 확인해 주세요.'},502);}}

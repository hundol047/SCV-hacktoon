import {z} from 'zod';
import {tripSchema} from '../../../domain/schema';
import {replacementInput,replacementInstructions,replacementReplySchema,validateReplacements} from '../../../domain/replacements';
import {reserveAI} from '../../../server/ai-budget';
import {sameOrigin,json,readJSON} from '../../../server/security';
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
  try{
    const {trip,itemId}=z.object({trip:tripSchema,itemId:z.string().min(1),consent:z.literal(true)}).parse(await readJSON(request));
    const input=replacementInput(trip,itemId),key=process.env.BOPok_AI_KEY,model=process.env.BOPok_AI_MODEL;
    if(!key||!model)return json({error:'서버 AI 키·모델이 미설정입니다. Android 앱에서는 개인 API 키를 등록할 수 있습니다.'},503);
    const gate=await reserveAI(request);if(!gate.allowed)return json({error:gate.message},429);
    const schema=z.toJSONSchema(replacementReplySchema);delete schema.$schema;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify({model,store:false,max_output_tokens:800,instructions:replacementInstructions,input:input.text,text:{format:{type:'json_schema',name:'replacement',strict:true,schema}}})});
    if(!r.ok)throw Error('AI 요청 실패');const body=await r.json();
    const text=body.output?.flatMap((o:{content?:{type:string;text?:string}[]})=>o.content??[]).find((o:{type:string})=>o.type==='output_text')?.text;
    if(typeof text!=='string')throw Error('추천 출력 없음');const result=replacementReplySchema.parse(JSON.parse(text));validateReplacements(trip,itemId,result);
    const response=json(result);if(gate.cookie)response.headers.set('Set-Cookie',gate.cookie);return response;
  }catch{return json({error:'추천을 완료하지 못했습니다. 기존 일정은 유지됩니다. 후보와 AI 연결을 확인해 주세요.'},502);}
}

import {z} from 'zod';
import {promotionInputSchema,promotionReplySchema,promotionInstructions} from '../../../domain/promotion';
import {reserveAI} from '../../../server/ai-budget';
import {sameOrigin,json,readJSON} from '../../../server/security';
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
  const parsed=z.object({input:promotionInputSchema,consent:z.literal(true)}).safeParse(await readJSON(request,16000).catch(()=>null));
  if(!parsed.success)return json({error:'상호·지역·업종·확인된 사실과 전송 동의를 확인하세요.'},400);
  const key=process.env.BOPok_AI_KEY,model=process.env.BOPok_AI_MODEL;if(!key||!model)return json({error:'서버 AI 키·모델이 미설정입니다. 기본 초안 또는 Android 개인 키를 이용하세요.'},503);
  try{const gate=await reserveAI(request);if(!gate.allowed)return json({error:gate.message},429);const schema=z.toJSONSchema(promotionReplySchema);delete schema.$schema;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify({model,store:false,max_output_tokens:1600,instructions:promotionInstructions,input:JSON.stringify(parsed.data.input),text:{format:{type:'json_schema',name:'promotion',strict:true,schema}}})});
    if(!r.ok)throw Error();const data=await r.json();const text=data.output?.flatMap((o:{content?:{type:string;text?:string}[]})=>o.content??[]).find((o:{type:string})=>o.type==='output_text')?.text;if(typeof text!=='string')throw Error();const output=promotionReplySchema.parse(JSON.parse(text));const response=json(output);if(gate.cookie)response.headers.set('Set-Cookie',gate.cookie);return response;
  }catch{return json({error:'AI 홍보 초안을 만들지 못했습니다. 기본 초안을 사용하거나 연결을 확인하세요.'},502);}
}

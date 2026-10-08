import {z} from 'zod';
import {measure} from '../../../server/metrics';
import {OpenAIProvider,extractWithFallback} from '../../../adapters/ai';
import {reserveAI} from '../../../server/ai-budget';
import {readJSON,json} from '../../../server/security';
export const runtime='nodejs';
const requestSchema=z.object({text:z.string().trim().min(1).max(1800),consent:z.boolean()});
let publicRulesWindow={count:0,until:0};
export async function POST(request:Request){
  const now=Date.now();if(publicRulesWindow.until<now)publicRulesWindow={count:0,until:now+60000};
  if(++publicRulesWindow.count>120)return json({error:'요청이 많습니다. 잠시 후 다시 시도해 주세요.'},429);
  try{
    const parsed=requestSchema.safeParse(await readJSON(request,16000));if(!parsed.success)return json({error:'여행 조건을 1~1800자로 입력해 주세요.'},400);
    if(/주민등록|진료\s*기록|복약|질병|\d{6}-?\d{7}/.test(parsed.data.text))return json({error:'의료 정보와 주민등록번호는 입력하지 마세요. 여행 취향과 걷기·휴식 조건만 써 주세요.'},400);
    const configured=parsed.data.consent&&process.env.BOPok_AI_KEY&&process.env.BOPok_AI_MODEL;
    const gate=configured?await reserveAI(request):null;
    const provider=configured&&gate?.allowed?new OpenAIProvider(process.env.BOPok_AI_KEY!,process.env.BOPok_AI_MODEL!):null;
    const result=await extractWithFallback(parsed.data.text,provider?{extract:(text:string)=>measure('ai',()=>provider.extract(text))}:null);
    const response=json({...result,...(gate&&!gate.allowed?{message:gate.message+' · 규칙 기반 점검'}:{}),usage:gate?.allowed?gate.usage:undefined});
    if(gate?.cookie)response.headers.set('Set-Cookie',gate.cookie);return response;
  }catch{return json({error:'입력 길이·형식과 숫자 범위를 확인해 주세요.'},400);}
}

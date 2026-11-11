import {appURL} from '../../../server/config';
import {labRuntime} from '../../../server/lab-runtime';
import {json,readJSON} from '../../../server/security';
import {bedrockConfigured} from '../../../server/bedrock';
import {reserveAI} from '../../../server/ai-budget';
import {z} from 'zod';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const lang=z.enum(['ko','en','ja','zh']).default('ko');
async function handle(request:Request){
 const url=new URL(request.url);if(url.pathname==='/lab')return new Response(null,{status:307,headers:{Location:'/lab/'}});const pathname=url.pathname.replace(/^\/lab/,'')||'/';
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==(appURL()||`${url.protocol}//${request.headers.get('host')||url.host}`))return json({error:'잘못된 요청 출처입니다.'},403);
 try{
  if(request.method==='POST'&&['/api/start','/api/guide','/api/lodging-check','/api/guide-translate'].includes(pathname)){
   const body=await readJSON(request,250000);
   if(!bedrockConfigured())return json({error:'기존 AWS AI 연결을 확인해 주세요. 입력 내용은 유지됩니다.'},503);
   const gate=await reserveAI(request);if(!gate.allowed)return json({error:gate.message},429);
   const {ai}=await labRuntime();let result;
   if(pathname==='/api/start'){const b=z.object({text:z.string().min(1).max(4000),lang}).parse(body);result=await ai.startFromText(b.text,new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()),b.lang);}
   else if(pathname==='/api/guide'){const b=z.object({question:z.string().min(1).max(4000),history:z.array(z.object({q:z.string().max(4000),a:z.string().max(10000)})).max(6).default([]),lang,trip:z.object({input:z.object({region:z.enum(['gangneung','seorak','chuncheon','pyeongchang','wonju']),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),days:z.number().int().min(1).max(5)}).passthrough(),days:z.array(z.object({items:z.array(z.object({id:z.string().max(100)}).passthrough()).max(30)}).passthrough()).max(5)}).passthrough()}).parse(body);result=await ai.guide(b);}
   else if(pathname==='/api/lodging-check'){result=await ai.lodgingCheck(z.object({text:z.string().min(20).max(20000),nights:z.number().int().min(1).max(5),date:z.string().max(10),lang}).parse(body));}
   else{const b=z.object({text:z.string().max(10000),lang}).parse(body);result=await ai.translateGuide(b.text,b.lang);}
   const response=json(result);if(gate.cookie)response.headers.set('Set-Cookie',gate.cookie);return response;
  }
  const {port}=await labRuntime();const headers=new Headers(request.headers);headers.set('host',request.headers.get('host')||url.host);headers.set('origin',`http://127.0.0.1:${port}`);headers.set('x-yeohaengit-origin',appURL()||`${url.protocol}//${request.headers.get('host')||url.host}`);headers.delete('accept-encoding');headers.delete('connection');headers.delete('content-length');
  const response=await fetch(`http://127.0.0.1:${port}${pathname}${url.search}`,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer(),redirect:'manual'});
  const outgoing=new Headers(response.headers);outgoing.delete('content-encoding');outgoing.delete('content-length');return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:outgoing});
 }catch(error){return json({error:error instanceof z.ZodError?'입력 내용을 확인해 주세요.':'요청을 완료하지 못했어요. 기존 일정은 유지됩니다.'},error instanceof z.ZodError?400:502);}
}
export {handle as GET,handle as POST,handle as PUT,handle as PATCH,handle as DELETE,handle as HEAD};

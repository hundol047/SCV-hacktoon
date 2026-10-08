import {z} from 'zod';
import {configuredRPC,TripStore,StoreError} from '../../../server/store';
import {ownerOf,sameOrigin,json,sessionResponse,hash,token,readJSON} from '../../../server/security';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
 const rpc=configuredRPC();if(!rpc||(process.env.BOPok_SESSION_SECRET?.length??0)<32)return json({error:'서버 저장소와 세션 설정이 필요합니다.'},503);
 try{
  const body=z.object({action:z.enum(['renew','refresh','recovery-key','recover']).default('renew'),key:z.string().regex(/^[-\w]{43}$/).optional()}).parse(await readJSON(request,1000,true));
  const owner=ownerOf(request),store=new TripStore(rpc);
  if(body.action==='recover'){
   if(!body.key)return json({error:'보관한 복구 키를 입력해 주세요.'},400);
   if(!(await store.reserve(hash('recovery-global'),{scope:'recovery',minuteLimit:20,dailyRequests:200})).allowed)return json({error:'복구 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'},429);
   const result=await rpc.call('bopok_identity',{p_action:'recover',p_hash:hash(body.key)});if(!result.owner)return json({error:'복구 키가 올바르지 않거나 만료되었습니다.'},403);
   await rpc.call('bopok_identity',{p_action:'touch',p_owner:result.owner});return sessionResponse(request,result.owner,{ready:true});
  }
  if(body.action==='recovery-key'){
   if(!owner)return json({error:'먼저 서버 저장 세션을 시작해 주세요.'},401);
   if(!(await store.reserve(hash('recovery:'+owner),{scope:'recovery',minuteLimit:3,dailyRequests:200})).allowed)return json({error:'복구 키 발급 한도에 도달했습니다.'},429);
   const key=token();await rpc.call('bopok_identity',{p_action:'set',p_owner:owner,p_hash:hash(key)});return sessionResponse(request,owner,{ready:true,key});
  }
  if(owner){await rpc.call('bopok_identity',{p_action:'touch',p_owner:owner});return sessionResponse(request,owner,{ready:true});}
  if(body.action==='refresh')return json({ready:false});
  if(!(await store.reserve(hash('session-global'),{scope:'session',minuteLimit:60,dailyRequests:1000})).allowed)return json({error:'신규 세션 발급 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'},429);
  return sessionResponse(request,hash(token()),{ready:true});
 }catch(e){return json({error:'세션 요청 형식 또는 서버 연결을 확인해 주세요.'},e instanceof StoreError?503:400);}
}

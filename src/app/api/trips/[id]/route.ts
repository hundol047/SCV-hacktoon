import {z} from 'zod';
import {TripStore,configuredRPC,StoreError} from '../../../../server/store';
import {ownerOf,capabilityOf,sameOrigin,json,readJSON,token,hash} from '../../../../server/security';
import {tripSchema,feedbackSchema} from '../../../../domain/schema';
type Context={params:Promise<{id:string}>};
async function handle(request:Request,context:Context,method:string){
  if(method!=='GET'&&!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
  const id=(await context.params).id;if(!z.string().uuid().safeParse(id).success)return json({error:'여행을 찾을 수 없습니다.'},404);
  const owner=ownerOf(request)??'',cap=capabilityOf(request),rpc=configuredRPC();
  if(!owner&&!cap)return json({error:'이 여행에 대한 접근 권한이 필요합니다.'},401);if(!rpc)return json({error:'서버 저장이 설정되지 않았습니다.'},503);
  const store=new TripStore(rpc);
  try{
    if(method==='GET')return json(await store.get(owner,id,cap));
    if(method==='DELETE')return json(await store.action('delete',owner,id,cap));
    const body=await readJSON(request);
    if(method==='PUT'){const p=z.object({trip:tripSchema,storageVersion:z.number().int().nonnegative()}).parse(body);if(!(await store.reserve(hash('storage:'+(owner||cap)),{scope:'storage',minuteLimit:10,dailyRequests:1000})).allowed)return json({error:'저장 요청 한도에 도달했습니다. 잠시 후 다시 저장해 주세요.'},429);return json(await store.update(owner,id,cap,p.trip,p.storageVersion));}
    const action=z.object({action:z.enum(['feedback','invite','revoke']),text:feedbackSchema.shape.text.optional(),role:z.enum(['viewer','editor']).optional()}).parse(body);
    if(action.action==='feedback'){if(!action.text)return json({error:'의견을 선택해 주세요.'},400);const current=await store.get(owner,id,cap);const quota=await store.reserve(hash('feedback:'+cap+owner),{scope:'feedback',minuteLimit:10,dailyRequests:5000});if(!quota.allowed)return json({error:'잠시 후 의견을 다시 남겨 주세요.'},429);return json(await store.action('feedback',owner,current.id,cap,{text:action.text}));}
    if(action.action==='invite'){const raw=token();const result=await store.action('invite',owner,id,hash(raw),undefined,undefined,action.role??'viewer');return json({...result,fragment:`trip=${id}&token=${raw}`});}
    return json(await store.action('revoke',owner,id,cap));
  }catch(e){if(e instanceof StoreError){const status={forbidden:403,not_found:404,conflict:409,limit:429,capacity:429}[e.code as 'forbidden']??503;return json({error:e.code==='conflict'?'다른 기기에서 일정이 변경되었습니다. 최신 일정을 확인한 뒤 적용해 주세요.':e.code==='forbidden'?'이 작업을 할 수 있는 권한이 없습니다.':e.code==='not_found'?'여행이 없거나 보관·공유 기간이 지났습니다.':e.code==='capacity'?'서버 저장 용량에 도달했습니다. 기존 여행을 삭제하거나 운영자에게 문의해 주세요.':'서버 요청을 처리하지 못했습니다.'},status);}return json({error:'요청 형식을 확인해 주세요.'},400);}
}
export const GET=(r:Request,c:Context)=>handle(r,c,'GET');
export const PUT=(r:Request,c:Context)=>handle(r,c,'PUT');
export const POST=(r:Request,c:Context)=>handle(r,c,'POST');
export const DELETE=(r:Request,c:Context)=>handle(r,c,'DELETE');

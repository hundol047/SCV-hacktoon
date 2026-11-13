import {accountOf} from '../../../server/account';
import {configuredRPC,TripStore} from '../../../server/store';
import {sameOrigin,json,readJSON,hash} from '../../../server/security';
import {encryptedBackupSchema} from '../../../adapters/evidence-backup';
export const runtime='nodejs';
async function handle(request:Request){
 if(request.method!=='GET'&&!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
 const account=accountOf(request);if(!account)return json({error:'계정에 로그인한 뒤 백업을 이용하세요.'},401);
 const base=process.env.BOPok_SUPABASE_URL,key=process.env.BOPok_SUPABASE_KEY;
 if(!base?.startsWith('https://')||!key)return json({error:'서버 증빙 보관 설정이 필요합니다. 암호화 파일 백업을 이용하세요.'},503);
 const object=`${account.id}/latest.json`,endpoint=base.replace(/\/$/,'')+'/storage/v1/object/yeohaengit-evidence-private/';
 try{
  const rpc=configuredRPC();if(!rpc)return json({error:'백업 저장소 설정을 확인하세요.'},503);
  const quota=await new TripStore(rpc).reserve(hash('evidence:'+account.id),{scope:'storage',minuteLimit:6,dailyRequests:60});if(!quota.allowed)return json({error:'백업 요청이 많아요. 잠시 후 다시 시도하세요.'},429);
  const headers:Record<string,string>={apikey:key,Authorization:'Bearer '+key};let body:string|undefined;
  if(request.method==='PUT'){body=JSON.stringify(encryptedBackupSchema.parse(await readJSON(request,24*1024*1024)));headers['Content-Type']='application/json';headers['x-upsert']='true';}
  if(request.method==='DELETE'){headers['Content-Type']='application/json';body=JSON.stringify({prefixes:[object]});}
  const response=await fetch((request.method==='DELETE'?endpoint.slice(0,-1):endpoint+object),{method:request.method==='PUT'?'POST':request.method,headers,body,signal:AbortSignal.timeout(20000),cache:'no-store'});
  if(!response.ok)return json({error:response.status===404?'저장된 백업이 없거나 비공개 저장소 설정이 필요합니다.':'증빙 서버 요청에 실패했어요. 파일 백업을 이용하세요.'},response.status===404?404:503);
  if(request.method==='GET')return json(encryptedBackupSchema.parse(await readJSON(new Request('https://backup.local',{method:'POST',body:response.body,duplex:'half'} as RequestInit),24*1024*1024)));
  return json({ok:true});
 }catch{return json({error:'백업 형식·용량 또는 서버 연결을 확인하세요.'},400);}
}
export const GET=handle;export const PUT=handle;export const DELETE=handle;

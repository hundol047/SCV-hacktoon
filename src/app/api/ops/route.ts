import {timingSafeEqual} from 'node:crypto';
import {accountOf,roleOf} from '../../../server/account';
import {json,sameOrigin,readJSON} from '../../../server/security';
import {readiness} from '../../../server/readiness';
import {operationalReport,operationalIssues,notifyFailure} from '../../../server/operations';
import {probeProviders} from '../../../server/provider-probes';
import {configuredRPC} from '../../../server/store';
function tokenAuthorized(request:Request){const expected=process.env.BOPok_OPS_SECRET,actual=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!expected||expected.length<32||!actual)return false;const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
function authorized(request:Request){return tokenAuthorized(request)||roleOf(accountOf(request),'operator');}
export async function GET(request:Request){if(!authorized(request))return json({error:'운영 담당자 계정이 필요합니다.'},403);return json({readiness:await readiness(),operations:await operationalReport()});}
export async function POST(request:Request){if(!authorized(request)||!tokenAuthorized(request)&&!sameOrigin(request))return json({error:'운영 권한이 필요합니다.'},403);try{const body=await readJSON(request,1000),rpc=configuredRPC();if(!rpc)return json({error:'운영 저장소 설정이 필요합니다.'},503);if(body.action==='providers')return json({checks:await probeProviders(rpc,{paid:body.paid===true})});if(body.action==='cleanup')return json(await rpc.call('bopok_maintenance',{}));if(body.action==='backup-verified'){await rpc.call('bopok_backup_record',{});return json({recorded:true});}if(body.action==='check'){const state=await readiness(),operations=await operationalReport(rpc),issues=[...state.missing,...operationalIssues(operations)];return json({readiness:state,operations,issues,alert:issues.length?await notifyFailure(issues,rpc):{sent:false,reason:'healthy'}});}return json({error:'지원하지 않는 운영 요청입니다.'},400);}catch{return json({error:'운영 요청을 완료하지 못했습니다.'},503);}}

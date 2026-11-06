import {z} from 'zod';
import {tripSchema} from '../../../domain/schema';
import {publicPlan} from '../../../domain/shared-plan';
import {sameOrigin,json,readJSON,hash,token as randomToken,anonymousOwner,sessionResponse} from '../../../server/security';
import {configuredRPC,TripStore} from '../../../server/store';
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'잘못된 요청입니다.'},403);try{
 const d=z.object({action:z.enum(['create','read','publish','propose','vote','confirm','cancel']),token:z.string().regex(/^[a-f0-9]{64}$/).optional(),trip:tripSchema.optional(),expected:z.number().int().nonnegative().optional(),proposalId:z.number().int().nonnegative().optional(),name:z.string().trim().min(1).max(40).optional(),approve:z.boolean().optional()}).parse(await readJSON(request,2000000));
 const rpc=configuredRPC();if(!rpc)throw Error('공유 저장 서버가 연결되지 않았습니다.');
 const existing=anonymousOwner(request),owner=existing??hash(randomToken());const gate=await new TripStore(rpc).reserve(owner,{scope:'storage',minuteLimit:60,dailyRequests:2000});if(!gate.allowed)return json({error:'공유 요청이 많습니다. 잠시 후 다시 시도하세요.'},429);
 if(['create','publish','propose'].includes(d.action)&&!d.trip)throw Error('공유할 일정이 필요합니다.');
 const token=d.action==='create'?hash(randomToken()):d.token;if(!token)throw Error('공유 링크를 확인하세요.');
 const result=await rpc.call('bopok_live',{p_action:d.action,p_token:hash(token),p_owner:owner,p_expected:d.expected??d.trip?.revision??0,p_payload:{...(d.trip?{document:publicPlan(d.trip),private:d.trip}:{}),proposalId:d.proposalId,name:d.name,approve:d.approve}});
 const messages:Record<string,string>={conflict:'공유 일정이 변경되었습니다. 최신 일정을 불러온 뒤 다시 시도하세요.',forbidden:'공유를 만든 브라우저에서만 일정을 변경할 수 있습니다.',votes_needed:'동행자 과반수의 찬성이 필요합니다.',expired:'공유 링크가 만료되었습니다.',stale_proposal:'변경안이 바뀌었습니다. 새 내용을 확인하고 투표하세요.',participants:'여행 인원 수만큼 투표가 등록되었습니다.'};
 if(result?.error)return json({error:messages[String(result.error)]??'요청을 저장하지 못했습니다.'},409);
 return existing?json({...result,token}):sessionResponse(request,owner,{...result,token});
 }catch{return json({error:'실시간 공유를 연결하지 못했습니다. 서버 설정과 014 데이터베이스 업데이트를 확인해 주세요.'},503);}}

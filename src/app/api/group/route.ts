import {z} from 'zod';
import {sameOrigin,json,readJSON,hash,token as randomToken,anonymousOwner,sessionResponse} from '../../../server/security';
import {configuredRPC,TripStore} from '../../../server/store';
const place=z.object({id:z.string().min(1).max(100),name:z.string().min(1).max(300)});
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'잘못된 요청입니다.'},403);try{
 const data=z.object({action:z.enum(['create','read','vote']),token:z.string().regex(/^[a-f0-9]{64}$/).optional(),places:z.array(place).max(100).optional(),placeId:z.string().max(100).optional(),name:z.string().trim().min(1).max(40).optional(),vote:z.number().int().min(-1).max(1).optional(),comment:z.string().max(300).optional()}).parse(await readJSON(request,50000));
 const rpc=configuredRPC();if(!rpc)return json({error:'동행자 의견 저장 서버가 연결되지 않았습니다.'},503);
 const existing=anonymousOwner(request),owner=existing??hash(randomToken());const gate=await new TripStore(rpc).reserve(owner,{scope:'storage',minuteLimit:60,dailyRequests:1000});if(!gate.allowed)return json({error:'요청이 많습니다. 잠시 후 다시 시도하세요.'},429);
 const room=data.action==='create'?hash(randomToken()):data.token;if(!room)return json({error:'초대 링크를 확인하세요.'},400);
 if(data.action==='vote'&&(!data.placeId||!data.name||data.vote===undefined))return json({error:'이름과 의견을 입력하세요.'},400);
 const result=await rpc.call('bopok_group',{p_action:data.action,p_token:hash(room),p_voter:owner,p_payload:{places:data.places??[],placeId:data.placeId,name:data.name,vote:data.vote,comment:data.comment??''}});
 if(result?.error)return json({error:'초대가 만료되었거나 의견을 저장할 수 없습니다.'},400);
 return existing?json({...result,token:room}):sessionResponse(request,owner,{...result,token:room});
 }catch{return json({error:'동행자 의견을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);}}

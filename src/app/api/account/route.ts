import {quotaLimit} from '../../../server/config';
import {z} from 'zod';
import {accountOf,roleOf,AuthProvider,accountCookies,cookieValue,REFRESH_COOKIE,hasAccount} from '../../../server/account';
import {ownerOf,anonymousOwner,sameOrigin,json,readJSON,hash} from '../../../server/security';
import {configuredRPC,TripStore} from '../../../server/store';
import {verifyBot} from '../../../server/bot';
export async function GET(request:Request){const account=accountOf(request);return json({configured:!!(process.env.BOPok_SUPABASE_URL&&process.env.BOPok_SUPABASE_ANON_KEY),authenticated:!!account,refreshNeeded:hasAccount(request)&&!account,email:account?.email,id:account?.id,reviewer:roleOf(account,'reviewer'),operator:roleOf(account,'operator'),botSiteKey:process.env.BOPok_TURNSTILE_SITE_KEY??null});}
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);try{
 const body=z.object({action:z.enum(['request','verify','refresh','logout']),email:z.string().email().max(254).optional(),code:z.string().regex(/^\d{6,10}$/).optional(),botToken:z.string().max(2048).optional()}).parse(await readJSON(request,4000));
 if(body.action==='logout')return accountCookies(request,json({authenticated:false}));
 const rpc=configuredRPC();if(!rpc)return json({error:'계정 저장소 설정이 필요합니다.'},503);const auth=new AuthProvider();
 if(!(await new TripStore(rpc).reserve(hash('account-global'),{scope:'auth',minuteLimit:quotaLimit('BOPok_AUTH_MINUTE_LIMIT',60,10000),dailyRequests:quotaLimit('BOPok_AUTH_DAILY_LIMIT',500)})).allowed)return json({error:'로그인 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'},429);
 if(body.action==='request'){if(!body.email)return json({error:'이메일을 입력해 주세요.'},400);if(!await verifyBot(body.botToken,'account'))return json({error:'사람 확인을 다시 완료해 주세요.'},403);await auth.request(body.email);return json({sent:true});}
 const value=body.action==='refresh'?await auth.refresh(cookieValue(request,REFRESH_COOKIE)??''):body.email&&body.code?await auth.verify(body.email,body.code):null;
 if(!value)return json({error:'이메일과 확인 코드를 입력해 주세요.'},400);
 const previous=!hasAccount(request)?anonymousOwner(request):null;
 if(previous)await rpc.call('bopok_claim',{p_owner:hash('account:'+value.account.id),p_previous:previous});
 return accountCookies(request,json({authenticated:true,email:value.account.email}),value);
 }catch{return json({error:'로그인 설정 또는 확인 코드·유효 시간을 확인해 주세요.'},400);}}

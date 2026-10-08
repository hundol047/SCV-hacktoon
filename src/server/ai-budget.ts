import {TripStore,configuredRPC} from './store';
import {ownerOf,issueSession,verifySession,COOKIE,sameOrigin} from './security';
export type AIGate={allowed:boolean;message:string;cookie?:string;usage?:{reservedTokens:number;reservedCostUsd:number}};
export async function reserveAI(request:Request):Promise<AIGate>{
  if(!sameOrigin(request))return {allowed:false,message:'외부 전송 요청의 출처를 확인할 수 없습니다.'};
  const rpc=configuredRPC(),key=process.env.BOPok_SESSION_SECRET;
  if(!rpc||!key||key.length<32)return {allowed:false,message:'AI 호출을 보내지 않았습니다. 서버 저장소·세션·분산 사용량 관리 설정이 필요합니다.'};
  const inputPrice=Number(process.env.BOPok_AI_INPUT_USD_PER_MILLION),outputPrice=Number(process.env.BOPok_AI_OUTPUT_USD_PER_MILLION);
  if(!Number.isFinite(inputPrice)||!Number.isFinite(outputPrice)||inputPrice<=0||outputPrice<=0)return {allowed:false,message:'AI 호출을 보내지 않았습니다. 선택한 모델의 토큰 단가 설정이 필요합니다.'};
  let subject=ownerOf(request),cookie:string|undefined;
  if(!subject){const signed=issueSession();subject=verifySession(signed)!;const secure=(process.env.BOPok_APP_URL??request.url).startsWith('https:');cookie=`${COOKIE}=${signed}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure?'; Secure':''}`;}
  const inputTokens=18000,outputTokens=1200,reservedTokens=inputTokens+outputTokens;
  const reservedCostUsd=(inputTokens*inputPrice+outputTokens*outputPrice)/1000000;
  const dailyCost=Number(process.env.BOPok_AI_DAILY_USD_LIMIT??1),dailyTokens=Number(process.env.BOPok_AI_DAILY_TOKEN_LIMIT??200000),dailyRequests=Number(process.env.BOPok_AI_DAILY_REQUEST_LIMIT??30);
  if(!Number.isFinite(dailyCost)||dailyCost<=0||dailyCost>100||!Number.isSafeInteger(dailyTokens)||dailyTokens<1||!Number.isSafeInteger(dailyRequests)||dailyRequests<1)return {allowed:false,message:'AI 비용·토큰·횟수 한도 설정을 확인해 주세요.'};
  try{const reservation=await new TripStore(rpc).reserve(subject,{scope:'ai',tokens:reservedTokens,cost:reservedCostUsd,dailyRequests,dailyTokens,dailyCost});return {allowed:reservation.allowed,message:reservation.allowed?'AI 사용량을 예약했습니다.':'AI 요청·토큰·일일 비용 한도에 도달했습니다. 규칙 기반으로 계속합니다.',cookie,usage:{reservedTokens,reservedCostUsd}};}
  catch{return {allowed:false,message:'사용량 저장소에 연결하지 못해 AI 요청을 보내지 않았습니다. 규칙 기반으로 계속합니다.',cookie};}
}

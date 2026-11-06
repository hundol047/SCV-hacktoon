import {anonymousOwner,hash} from './security';
import {configuredRPC,TripStore} from './store';
export async function planningQuota(request:Request){const rpc=configuredRPC();if(!rpc)return;const owner=anonymousOwner(request)??hash('public-planning:'+new URL(request.url).origin);const gate=await new TripStore(rpc).reserve(owner,{scope:'route',minuteLimit:15,dailyRequests:200});if(!gate.allowed)throw Error('도로·숙소 조회 요청이 많습니다. 잠시 후 다시 시도하세요.');}

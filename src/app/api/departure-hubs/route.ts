import {sameOrigin,json,readJSON} from '../../../server/security';
import {configuredRPC} from '../../../server/store';
import {departureHubs,hubPoint,fallbackRailHubs} from '../../../server/departure-hubs';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'잘못된 요청입니다.'},403);
 let point;try{point=hubPoint.parse(await readJSON(request,1000));}catch{return json({error:'출발지 좌표를 확인하세요.'},400);}
 try{const rpc=configuredRPC();if(!rpc)throw Error();return json({hubs:await departureHubs(point,rpc),fallback:false});}
 catch{const hubs=fallbackRailHubs(point);return hubs.length?json({hubs,fallback:true,source:'https://www.letskorail.com/'}):json({error:'주변 역 조회가 지연되고 있어요. 지도 검색으로 확인하거나 다시 조회해 주세요.'},503);}
}

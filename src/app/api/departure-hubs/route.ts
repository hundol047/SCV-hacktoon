import {sameOrigin,json,readJSON} from '../../../server/security';
import {configuredRPC} from '../../../server/store';
import {departureHubs,hubPoint} from '../../../server/departure-hubs';
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'잘못된 요청입니다.'},403);try{const point=hubPoint.parse(await readJSON(request,1000));const rpc=configuredRPC();if(!rpc)return json({error:'주변 터미널·역을 조회하지 못했습니다.'},503);return json({hubs:await departureHubs(point,rpc)});}catch{return json({error:'주변 터미널·역 조회가 지연되고 있습니다. 다시 조회하거나 지도에서 확인하세요.'},503);}}

import {sameOrigin,json,readJSON} from '../../../../server/security';
import {configuredRPC} from '../../../../server/store';
import {currentPointSchema,reverseLocation} from '../../../../server/reverse-location';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'잘못된 요청 출처입니다.'},403);
 try{const point=currentPointSchema.parse(await readJSON(request,1000));const rpc=configuredRPC();return json({location:rpc?await reverseLocation(point,rpc):{...point,id:'current-location',name:'현재 위치',address:'현재 위치'}});}
 catch{return json({error:'현재 위치는 국내 출발지에서 사용할 수 있습니다.'},400);}
}

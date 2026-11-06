import {planningQuota} from '../../../server/planning-quota';
import {z} from 'zod';
import {basicsSchema,conditionsSchema} from '../../../domain/schema';
import {catalogSchema} from '../../../data/catalog';
import {sameOrigin,json,readJSON} from '../../../server/security';
import {prepareTrip} from '../../../server/prepare-trip';
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'잘못된 요청입니다.'},403);try{await planningQuota(request);const {basics,conditions,catalog}=z.object({basics:basicsSchema,conditions:conditionsSchema,catalog:catalogSchema}).parse(await readJSON(request));if(basics.days>5)return json({error:'최대 5일을 선택하세요.'},400);return json({trip:await prepareTrip(basics,conditions,catalog)});}catch(e){return json({error:e instanceof z.ZodError?'일정 입력값을 확인해 주세요.':e instanceof Error?e.message:'도로·영업시간 반영에 실패했습니다.'},422);}}

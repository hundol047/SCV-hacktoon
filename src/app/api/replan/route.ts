import {planningQuota} from '../../../server/planning-quota';
import {z} from 'zod';
import {tripSchema} from '../../../domain/schema';
import {weatherSchema} from '../../../domain/weather';
import {sameOrigin,json,readJSON} from '../../../server/security';
import {replanTrip} from '../../../server/replan-trip';
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'잘못된 요청입니다.'},403);try{await planningQuota(request);const data=z.object({trip:tripSchema,day:z.number().int().min(1).max(5),from:z.number().int().min(0).max(1439),weather:z.union([weatherSchema,z.literal('auto')]),completed:z.array(z.string().max(100)).max(100).optional(),scores:z.record(z.string().max(100),z.number().int().min(-20).max(20)).refine(v=>Object.keys(v).length<=100)}).parse(await readJSON(request));if(data.day>data.trip.basics.days)throw Error('여행일을 확인하세요.');return json({trip:await replanTrip(data.trip,data.day,data.from,data.weather,data.scores,fetch,data.completed)});}catch(e){return json({error:e instanceof z.ZodError?'입력값을 확인하세요.':e instanceof Error?e.message:'재추천에 실패했습니다. 기존 일정을 유지합니다.'},422);}}

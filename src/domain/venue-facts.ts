import {z} from 'zod';
import {Place,Fact} from '../data/demo';
export const venueRecordSchema=z.object({source:z.string().url().max(1000).refine(v=>new URL(v).protocol==='https:','HTTPS 자료 주소를 입력해 주세요.'),at:z.string().datetime().refine(v=>Date.parse(v)<=Date.now(),'확인 날짜는 미래일 수 없습니다.'),walkMin:z.number().min(0).max(180).nullable(),walkM:z.number().min(0).max(10000).nullable(),stairs:z.boolean().nullable(),seat:z.boolean().nullable(),cost:z.number().min(0).max(10000000).nullable(),foods:z.array(z.string().trim().min(1).max(60)).max(12).nullable()});
export function recordVenue(place:Place,input:unknown):Place{
 const record=venueRecordSchema.parse(input);const fact=<T>(field:string,value:T|null):Fact<T>=>({value,evidenceId:`${place.id}:user:${field}:${record.at}`,source:record.source,nature:'real',checked:value===null?'unknown':'user',collectedAt:record.at});
 const {review,...original}=place;void review;return {...original,walkMin:fact('walkMin',record.walkMin),walkM:fact('walkM',record.walkM),stairs:fact('stairs',record.stairs),seat:fact('seat',record.seat),cost:fact('cost',record.cost),foods:fact('foods',record.foods)};
}

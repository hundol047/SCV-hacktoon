import {z} from 'zod';
import type {Place} from '../data/demo';
export const facilityNames={parking:'주차장',dropoff:'승하차 공간',toilet:'화장실',elevator:'엘리베이터'} as const;
export const facilityKeys=Object.keys(facilityNames) as (keyof typeof facilityNames)[];
export type Facility=keyof typeof facilityNames;
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;});
export const openingSchema=z.object({open:z.number().int().min(0).max(1439),close:z.number().int().min(1).max(1440),closedWeekdays:z.array(z.number().int().min(0).max(6)).max(7),closedDates:z.array(date).max(100),reservationRequired:z.boolean().nullable()}).refine(v=>v.open<v.close,'당일 영업 시작·종료 시간을 확인하세요.');
export type OpeningInfo=z.infer<typeof openingSchema>;
export function recentFact(f:{checked:string;source:string;collectedAt?:string|null}|undefined,now=Date.now()){
 const age=now-Date.parse(f?.collectedAt??'');return !!f&&['source','user'].includes(f.checked)&&f.source.startsWith('https://')&&age>=0&&age<7*86400000;
}
export function confirmedFacilities(p:Place,required:Facility[]=[]){return required.every(key=>p.facilities?.[key]?.value===true&&recentFact(p.facilities[key]));}
export function availability(p:Place,date:string,start:number,end:number,confirmed=false):{status:'violation'|'unknown';message:string}[]{
 const f=p.opening;if(!f)return [];
 if(!f.value||!recentFact(f))return [{status:'unknown',message:'최신 운영시간·휴무·예약 안내를 다시 확인하세요.'}];
 const v=f.value,issues:{status:'violation'|'unknown';message:string}[]=[];
 if(v.closedDates.includes(date)||v.closedWeekdays.includes(new Date(date+'T12:00:00Z').getUTCDay()))issues.push({status:'violation',message:'등록한 운영 정보상 이 날짜는 휴무입니다.'});
 if(start<v.open||end>v.close)issues.push({status:'violation',message:'방문 시간이 등록한 운영시간 밖입니다.'});
 if(v.reservationRequired&&!confirmed)issues.push({status:'unknown',message:'예약이 필요한 장소입니다. 예약 완료 여부를 확인하세요.'});
 if(v.reservationRequired===null)issues.push({status:'unknown',message:'예약 필요 여부가 미확인입니다.'});
 return issues;
}

export function closedOn(p:Place,date:string){const f=p.opening;return !!f?.value&&recentFact(f)&&(f.value.closedDates.includes(date)||f.value.closedWeekdays.includes(new Date(date+'T12:00:00Z').getUTCDay()));}

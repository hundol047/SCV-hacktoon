import {z} from 'zod';
import type {Basics,Conditions} from './schema';
import type {Catalog} from '../data/catalog';
import {courseInput,regionalCourse} from './regional-course';
import {savePlan} from './course-plans';
export const batchReplySchema=z.object({days:z.array(z.object({day:z.number().int().min(1).max(5),candidateIds:z.array(z.string().max(100)).min(2).max(4)})).min(1).max(5)});
export function batchInput(basics:Basics,conditions:Conditions,catalog:Catalog){
 if(basics.days>5)throw Error('빠른 일정 생성은 최대 5일까지 가능합니다.');
 const inputs=Array.from({length:basics.days},(_,i)=>JSON.parse(courseInput(basics,conditions,catalog,i+1).text));
 const candidates=new Map<string,unknown>();for(const input of inputs)for(const candidate of input.candidates){const {distanceKm,...facts}=candidate;candidates.set(candidate.id,facts);}
 return JSON.stringify({region:basics.region,daySession:basics.daySession,date:basics.date,departureRegion:basics.departureRegion,travelers:basics.travelers,transport:basics.transport,conditions,candidates:[...candidates.values()],days:inputs.map(input=>({day:input.day,weather:input.weather,weatherSource:input.weatherSource,origin:input.origin,maxAttractions:input.maxAttractions,candidates:input.candidates.map((p:{id:string;distanceKm:number})=>({id:p.id,distanceKm:p.distanceKm}))}))});
}
export function validateBatch(basics:Basics,conditions:Conditions,catalog:Catalog,raw:unknown){
 const reply=batchReplySchema.parse(raw);if(reply.days.length!==basics.days||new Set(reply.days.map(d=>d.day)).size!==basics.days||reply.days.some(d=>d.day>basics.days))throw Error('날짜별 일정이 누락되었습니다.');
 let next=basics;for(const d of [...reply.days].sort((a,b)=>a.day-b.day))next=savePlan(next,regionalCourse(next,conditions,catalog,d.day,d).plan);return {reply,basics:next};
}

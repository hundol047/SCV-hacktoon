import {z} from 'zod';
import type {Trip} from './schema';
import {defaultBasics,defaultConditions} from './schema';
import type {Place} from '../data/demo';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===v;});
export const eventSchema=z.object({id:z.string().min(1).max(100),title:z.string().trim().min(1).max(160),region:z.string().trim().min(1).max(100),kind:z.enum(['festival','culture']),start:date,end:date,address:z.string().trim().min(1).max(300),description:z.string().max(1000),source:z.string().url().max(1000).refine(v=>new URL(v).protocol==='https:'),latitude:z.number().min(-90).max(90).nullable(),longitude:z.number().min(-180).max(180).nullable(),origin:z.enum(['manual','import','tourapi']),collectedAt:z.string().datetime()}).refine(e=>e.start<=e.end,'행사 종료일은 시작일 이후여야 합니다.');
export type LocalEvent=z.infer<typeof eventSchema>;
export const eventFileSchema=z.object({version:z.literal(1),events:z.array(eventSchema).max(1000)});
export function filterEvents(events:LocalEvent[],query:string,region:string,kind:string,start:string,end:string){return events.filter(e=>(!region||e.region.includes(region))&&(!kind||e.kind===kind)&&(!start||e.end>=start)&&(!end||e.start<=end)&&[e.title,e.region,e.address,e.description].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title,'ko'));}
export function mergeEvents(existing:LocalEvent[],incoming:LocalEvent[]){return [...new Map([...existing,...incoming].map(e=>[e.id,e])).values()].slice(-1000);}
export function eventTrip(raw:LocalEvent,travelDate:string):Trip{
  const event=eventSchema.parse(raw);date.parse(travelDate);
  if(travelDate<event.start||travelDate>event.end)throw Error('행사 기간 안의 방문 날짜를 선택하세요.');
  if(event.latitude===null||event.longitude===null)throw Error('여행 연결에는 행사 장소의 좌표가 필요합니다.');
  const fact=<T>(field:string)=>({value:null as T|null,evidenceId:event.id+':'+field,source:event.source,nature:'real' as const,checked:'unknown' as const,collectedAt:event.collectedAt});
  const p:Place={id:event.id,name:event.title,kind:'visit',region:event.region,latitude:event.latitude,longitude:event.longitude,experiences:['문화·전시'],description:`행사 자료: ${event.start}~${event.end} · ${event.address}. 운영시간·취소 여부·입장료는 원문 확인 필요.`,walkMin:fact<number>('walkMin'),walkM:fact<number>('walkM'),stairs:fact<boolean>('stairs'),seat:fact<boolean>('seat'),foods:fact<string[]>('foods'),cost:fact<number>('cost'),hours:fact<[number,number]>('hours'),situations:fact<string[]>('situations')};
  return {version:1,id:crypto.randomUUID(),revision:0,basics:{...defaultBasics,title:(event.title+' 방문').slice(0,80),mode:'real',region:event.region,date:travelDate,days:1,transport:'taxi'},conditions:defaultConditions,items:[{id:'event-visit',day:1,start:600,end:660,kind:'visit',placeId:p.id,fromId:null,toId:null,transport:null,locked:false,mode:'real'}],history:[],feedback:[],catalog:{mode:'real',region:event.region,places:[p],routes:[],collectedAt:event.collectedAt,sourceNotice:'행사 방문 초안 · 10:00~11:00은 편집용 시간입니다. 행사 운영시간과 취소 여부를 원문에서 확인하세요.'}};
}

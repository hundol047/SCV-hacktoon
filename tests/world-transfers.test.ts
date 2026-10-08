import {it,expect} from 'vitest';
import {basicsSchema,defaultBasics,defaultConditions,dayDate,type Item} from '../src/domain/schema';
import {validateSchedule} from '../src/domain/validate';
import {osmCatalog} from '../src/adapters/real-data';
import {generate} from '../src/domain/engine';
const catalog=osmCatalog('A · B',{elements:[{type:'node',id:1,lat:37.5,lon:127,tags:{name:'A 공원',leisure:'park'}},{type:'node',id:2,lat:37.6,lon:127,tags:{name:'B 공원',leisure:'park'}}]},new Date().toISOString());
catalog.places=catalog.places.map((p,i)=>({...p,region:i?'B':'A'}));
const destination=(region:string,startDay:number,endDay=startDay)=>({region,startDay,endDay,timezone:'Asia/Seoul',currency:'KRW'});
const transfer=(fromRegion:string,toRegion:string,date:string,arrival=date+'T18:00:00+09:00')=>({fromRegion,toRegion,departure:date+'T17:00:00+09:00',arrival,source:'https://example.org/timetable',mode:'rail' as const});
const row=(day:number,place=0):Item=>({id:'row'+day,day,start:540,end:600,kind:'visit',placeId:catalog.places[place].id,fromId:null,toId:null,transport:null,locked:false,mode:'real'});
it('return visits match dated transfers rather than reusing the first city pair',()=>{
 const b=basicsSchema.parse({...defaultBasics,mode:'real',region:'A · B',days:4,destinations:[destination('A',1),destination('B',2),destination('A',3),destination('B',4)],transfers:[transfer('A','B','2026-10-17'),transfer('B','A','2026-10-18'),transfer('A','B','2026-10-19')]});
 expect(validateSchedule([row(1),row(2,1),row(3),row(4,1)],defaultConditions,b,catalog).issues.filter(i=>i.code==='intercity-overlap')).toEqual([]);
 b.transfers![2].departure='2026-10-19T09:30:00+09:00';expect(validateSchedule([row(1),row(2,1),row(3),row(4,1)],defaultConditions,b,catalog).issues.some(i=>i.code==='intercity-overlap')).toBe(true);
});
it('a whole travel day needs no sightseeing or lunch rows and generation skips it',()=>{
 const b=basicsSchema.parse({...defaultBasics,mode:'real',region:'A · B',days:3,destinations:[destination('A',1,2),destination('B',3)],transfers:[transfer('A','B','2026-10-17','2026-10-19T08:00:00+09:00')]});
 const issues=validateSchedule([row(1),row(3,1)],defaultConditions,b,catalog).issues;
 expect(issues.filter(i=>i.code==='empty-day')).toEqual([]);expect(issues.filter(i=>i.code==='meal-missing').map(i=>i.message)).not.toContain('2일차 식사 일정이 없습니다.');
 expect(generate(defaultConditions,b,[],[],catalog).items.some(i=>i.day===2)).toBe(false);
 b.transfers=[];expect(validateSchedule([row(1),row(3,1)],defaultConditions,b,catalog).issues.some(i=>i.code==='empty-day')).toBe(true);
});
it('explicit travel days require an overlapping transfer and destination local dates cross the date line',()=>{
 const b=basicsSchema.parse({...defaultBasics,mode:'real',region:'A · B',days:2,travelDays:[2],destinations:[destination('A',1),{...destination('B',2),timezone:'America/New_York',localStartDate:'2026-10-17'}],transfers:[]});
 expect(dayDate(b,2)).toBe('2026-10-17');expect(validateSchedule([row(1)],defaultConditions,b,catalog).issues.some(i=>i.code==='travel-day-evidence')).toBe(true);
});

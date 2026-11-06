import type {Trip} from './schema';
import {airOrSeaTrip} from './booking';
import {haversineKm} from './taxi-plan';
export type EstimateRates={meal:number;admission:number;cafe:number;room:number;local:number;roundTrip:number};
export function estimateDefaults(trip:Trip):EstimateRates{
 const b=trip.basics,first=trip.catalog?.places.find(p=>p.id===trip.items.find(i=>i.placeId)?.placeId);
 const far=!!b.departureCoordinates&&!!first&&(haversineKm(b.departureCoordinates,first)??0)>=60;
 return {meal:15000,admission:10000,cafe:6000,room:100000,local:b.transport==='taxi'?40000:b.transport==='driving'?30000:b.transport==='transit'?10000:0,roundTrip:airOrSeaTrip(b)?(b.timezone==='Asia/Seoul'?200000:600000):far&&b.transport!=='driving'?60000:0};
}
export function estimateTrip(trip:Trip,rates:EstimateRates){
 const n=trip.basics.travelers??1,days=trip.basics.days,rooms=Math.ceil(n/2),vehicles=Math.ceil(n/4);
 const safe=(x:number)=>Number.isFinite(x)?Math.max(0,Math.min(10000000,x)):0;
 const r=Object.fromEntries(Object.entries(rates).map(([k,v])=>[k,safe(v)])) as EstimateRates;
 const meals=trip.items.filter(i=>i.kind==='meal').length||(trip.basics.travelHours?0:days*(trip.basics.daySession==='afternoon'?1:2));
 // A visit followed by a rest is one admission, not two tickets.
 const visits=trip.items.filter(i=>i.kind==='visit');
 const admission=visits.reduce((sum,i)=>{const p=trip.catalog?.places.find(p=>p.id===i.placeId);const known=trip.basics.currency==='KRW'||!trip.basics.currency?p?.cost.value:null;return sum+(known!=null?safe(known):r.admission)*n;},0);
 const localUnits=trip.basics.transport==='taxi'||trip.basics.transport==='driving'?vehicles:n;
 const rows=[{name:'식사',amount:meals*r.meal*n,basis:`${meals}끼 × ${n}명`},{name:'관광·입장',amount:admission,basis:`${visits.length}곳 × ${n}명 · 등록 요금 우선`},{name:'카페·간식',amount:days*r.cafe*n,basis:`하루 1회 × ${days}일 × ${n}명`},{name:'숙박',amount:Math.max(0,days-1)*rooms*r.room,basis:`${Math.max(0,days-1)}박 × ${rooms}객실 (2인실)`},{name:'지역 내 교통',amount:days*localUnits*r.local,basis:`${days}일 × ${localUnits}${trip.basics.transport==='taxi'||trip.basics.transport==='driving'?'대':'명'}`},{name:'목적지 왕복 이동',amount:r.roundTrip*n,basis:`${n}명 · 왕복 금액 직접 조정`}];
 const total=rows.reduce((s,r)=>s+r.amount,0);return {rows,total,perPerson:Math.ceil(total/n),people:n};
}

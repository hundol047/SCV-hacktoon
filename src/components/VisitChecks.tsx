'use client';
import type {Trip} from '../domain/schema';
import {dayDate} from '../domain/schema';
import {availability,facilityKeys,facilityNames,recentFact} from '../domain/venue-details';
import FacilityFilter from './FacilityFilter';
export default function VisitChecks({trip,onTrip}:{trip:Trip;onTrip:(t:Trip)=>void}){
 if(trip.basics.mode!=='real')return null;
 const seen=new Set<string>();const visits=trip.items.filter(i=>i.kind==='visit'||i.kind==='meal').filter(i=>{const key=i.day+':'+i.placeId;if(seen.has(key))return false;seen.add(key);return true;});
 return <details className="cloud-panel"><summary>출발 전 확인 · 시설·영업·예약</summary><FacilityFilter basics={trip.basics} onChange={basics=>onTrip({...trip,basics,revision:trip.revision+1})}/>
 {visits.map(i=>{const p=trip.catalog?.places.find(p=>p.id===i.placeId);if(!p)return null;const date=dayDate(trip.basics,i.day),confirmed=trip.basics.reservations?.some(r=>r.placeId===p.id&&r.date===date)??false;const checks=availability(p,date,i.start,i.end,confirmed);return <article key={i.id}><h3>{i.day}일차 · {p.name}</h3><p>{facilityKeys.map(k=>`${facilityNames[k]}: ${!recentFact(p.facilities?.[k])||p.facilities?.[k]?.value==null?'미확인':p.facilities[k]!.value?'있음':'없음'}`).join(' · ')}</p>{checks.length?<ul>{checks.map((c,n)=><li key={n}>{c.message}</li>)}</ul>:<p>{p.opening?.value?'기록된 운영시간과 방문 시간이 맞습니다. 출발 전 변경 여부를 다시 확인하세요.':'운영시간·휴무·예약 정보 미확인'}</p>}
 {p.opening?.value?.reservationRequired&&<label className="check-row"><input type="checkbox" checked={confirmed} onChange={e=>{const rows=(trip.basics.reservations??[]).filter(r=>!(r.placeId===p.id&&r.date===date));onTrip({...trip,revision:trip.revision+1,basics:{...trip.basics,reservations:e.target.checked?[...rows,{placeId:p.id,date,confirmedAt:new Date().toISOString()}]:rows}});}}/>이 날짜의 예약 완료를 직접 확인했습니다</label>}
 </article>;})}<p>앱에서 예약을 대신 접수하거나 확정하지 않습니다. 자세한 근거는 ‘출발 전 시설·메뉴 확인 기록’에서 입력하세요.</p></details>;
}

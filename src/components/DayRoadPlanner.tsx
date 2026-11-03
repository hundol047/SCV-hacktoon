'use client';
import {useEffect,useRef,useState} from 'react';
import type {Trip} from '../domain/schema';
import {dayStops,roadBasePlan,tableURL,parseRoadTable,improveRoadOrder,dayRoadURL,parseDayRoad,roadDayProposal,type DayRoad} from '../domain/road-day';
import {publicTravelJSON} from '../adapters/public-travel';
import type {Place} from '../data/demo';
import {taxiPlanSummary} from '../domain/taxi-plan';
import RoadMap from './RoadMap';
type Preview={trip:Trip;road:DayRoad;stops:Place[];before:string[];after:string[];beforeMinutes:number;key:string;plan:ReturnType<typeof roadDayProposal>['plan']};
export default function DayRoadPlanner({trip,onTrip}:{trip:Trip;onTrip:(t:Trip)=>void}){
 const [day,setDay]=useState(1),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[preview,setPreview]=useState<Preview|null>(null);
 const key=`${trip.id}:${trip.revision}:${day}`,latest=useRef(key),controller=useRef<AbortController|null>(null);latest.current=key;
 useEffect(()=>{controller.current?.abort();setBusy(false);setPreview(null);setMessage('');return()=>controller.current?.abort();},[key]);
 if(trip.basics.mode!=='real'||!['taxi','driving'].includes(trip.basics.transport))return null;
 async function calculate(){const c=new AbortController();controller.current=c;setBusy(true);setMessage('');setPreview(null);
  try{
   const places=dayStops(trip,day),base=roadBasePlan(trip,day,places),ids=places.map(p=>p.id);
   const table=parseRoadTable(await publicTravelJSON(tableURL(places),c.signal),places);
   const improved=improveRoadOrder(table,ids,base.startPlaceId,base.endPlaceId,base.returnToStart??false,trip.basics.travelPriority==='budget'?'distance':'time');
   const order=improved.order.map(id=>places.find(p=>p.id===id)!);const stops=base.returnToStart?[...order,order[0]]:order;
   const road=parseDayRoad(await publicTravelJSON(dayRoadURL(stops),c.signal),stops);
   const proposal=roadDayProposal(trip,day,base,order,road);
   const current=base.returnToStart?[...ids,ids[0]]:ids;
   const beforeSeconds=current.slice(1).reduce((sum,id,i)=>sum+(table.durations[ids.indexOf(current[i])][ids.indexOf(id)]??Infinity),0);
   if(!c.signal.aborted&&latest.current===key)setPreview({...proposal,road,stops,before:places.map(p=>p.name),after:order.map(p=>p.name),beforeMinutes:Math.ceil(beforeSeconds/60),key});
  }catch(e){if(!c.signal.aborted)setMessage(e instanceof Error?e.message:'전체 도로 조회에 실패했습니다. 기존 일정을 유지합니다.');}
  finally{if(!c.signal.aborted)setBusy(false);}
 }
 return <section className="cloud-panel day-road-planner"><h2>하루 코스 한눈에</h2><p>도로 거리·시간으로 순서를 비교하고, 식사·휴식과 비용 가정까지 다시 계산합니다. 확인 후 적용할 때만 일정이 바뀝니다.</p><label>도로 코스 여행일<select value={day} disabled={busy} onChange={e=>setDay(Number(e.target.value))}>{Array.from({length:trip.basics.days},(_,i)=><option key={i} value={i+1}>{i+1}일차</option>)}</select></label>
 <button type="button" className="primary" disabled={busy} onClick={calculate}>{busy?'도로 기준 코스 계산 중…':'도로 기준으로 다시 계산'}</button>{busy&&<button type="button" onClick={()=>{controller.current?.abort();setBusy(false);setMessage('조회를 취소했습니다. 기존 일정은 유지됩니다.');}}>전체 도로 조회 취소</button>}
 {preview?.key===key&&<div className="day-road-preview"><RoadMap from={preview.stops[0]} to={preview.stops.at(-1)!} stops={preview.stops} route={preview.road}/><p>전체 도로 {(preview.road.distance/1000).toFixed(2)}km · 총 이동 약 {Math.ceil(preview.road.seconds/60)}분{Number.isFinite(preview.beforeMinutes)?` · 기존 순서 도로 조회 약 ${preview.beforeMinutes}분`:''}</p><table><caption>방문 순서 비교</caption><thead><tr><th>기존</th><th>도로 기준 제안</th></tr></thead><tbody>{preview.before.map((name,i)=><tr key={i}><td>{i+1}. {name}</td><td>{i+1}. {preview.after[i]}</td></tr>)}</tbody></table><p>{taxiPlanSummary(preview.plan)}</p><p>장소별 체류·식사·휴식 시간을 다시 배정합니다. 다른 날짜는 유지합니다.</p><button type="button" className="primary" onClick={()=>{if(latest.current!==preview.key||Date.now()-Date.parse(preview.road.fetchedAt)>3600000){setMessage('일정이 바뀌었거나 경로가 오래됐습니다. 다시 계산하세요.');return;}try{roadBasePlan(trip,day,dayStops(trip,day));onTrip(preview.trip);}catch(e){setMessage((e as Error).message);}}}>이 도로 코스를 일정에 적용</button></div>}
 <p role="status">{message}</p><details><summary>계산 기준</summary><p>장소 좌표를 OSRM에 전송합니다. 예산 우선은 도로 거리, 나머지는 예상 시간을 비교합니다. 고정 출발·도착·복귀 조건을 유지하며 최적해를 보장하지 않습니다. 실시간 교통과 택시 견적은 아닙니다. 비용 입력이 없으면 금액을 추정하지 않습니다. 장소와 도로 연결점 사이의 보행·승하차는 별도 확인하세요.</p></details></section>;
}

'use client';
import {useRef,useState} from 'react';
import {Trip} from '../domain/schema';
import {routeSchema} from '../data/catalog';
export default function RouteLookup({trip,onTrip}:{trip:Trip;onTrip:(trip:Trip)=>void}){
 const latest=useRef(trip);latest.current=trip;
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(trip.basics.mode!=='real'||!trip.catalog)return null;
 async function lookup(){setBusy(true);setMessage('');const routes=[...trip.catalog!.routes];let count=0;try{
 const session=await fetch('/api/session',{method:'POST'});if(!session.ok)throw Error('경로 조회에는 서버 세션 연결이 필요합니다.');
 const moves=trip.items.filter(i=>i.kind==='move'&&i.fromId&&i.toId&&i.transport);
 for(const move of moves){if(routes.some(r=>r.fromId===move.fromId&&r.toId===move.toId&&r.transport===move.transport))continue;
 const res=await fetch('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({region:trip.basics.region,fromId:move.fromId,toId:move.toId,transport:move.transport})});const data=await res.json();if(!res.ok)throw Error(data.error);const route=routeSchema.parse(data);routes.push(route);count++;
 // Preserve all manually allocated/fixed times; the validator highlights insufficient time.

 }
 setMessage(`${count}개 경로를 조회했습니다. 배정 시간은 유지하며 부족한 시간·미확인 계단·비용을 다시 점검합니다.`);
 }catch(e){setMessage(e instanceof Error?e.message:'경로 조회에 실패했습니다.');}finally{if(count&&latest.current.id===trip.id&&latest.current.revision===trip.revision)onTrip({...trip,catalog:{...trip.catalog!,routes},revision:trip.revision+1});else if(count)setMessage('조회 중 일정이 변경되어 이전 응답을 적용하지 않았습니다.');setBusy(false);}}
 return <section className="cloud-panel no-print"><h2>실제 이동 경로 확인</h2><button className="secondary" disabled={busy} onClick={lookup}>{busy?'경로 확인 중…':'일정의 미확인 경로 조회'}</button>{message&&<p role="status">{message}</p>}<p>실제 도로 경로의 시간·거리만 조회합니다. 내부 보행·계단·택시 요금은 별도 확인이 필요합니다. 배정한 시간과 고정 일정은 변경하지 않습니다.</p></section>;
}

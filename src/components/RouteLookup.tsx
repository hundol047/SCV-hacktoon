'use client';
import {useRef,useState} from 'react';
import {Trip} from '../domain/schema';
import {catalogSchema,routeSchema} from '../data/catalog';
export default function RouteLookup({trip,onTrip,cloudId,accessToken}:{trip:Trip;onTrip:(trip:Trip)=>void;cloudId?:string;accessToken?:string}){
 const latest=useRef(trip);latest.current=trip;const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(trip.basics.mode!=='real'||!trip.catalog)return null;
 const headers={'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})};
 async function session(){const response=await fetch('/api/session',{method:'POST'});if(!response.ok)throw Error('실제 정보 조회에는 서버 세션 연결이 필요합니다.');}
 function apply(catalog:NonNullable<Trip['catalog']>){if(latest.current.id!==trip.id||latest.current.revision!==trip.revision){setMessage('조회 중 일정이 변경되어 이전 응답을 적용하지 않았습니다.');return;}onTrip({...trip,catalog,revision:trip.revision+1});}
 async function refreshPlaces(){setBusy(true);setMessage('');try{await session();const r=await fetch('/api/catalog',{method:'POST',headers,body:JSON.stringify({action:'refresh',region:trip.basics.region})}),data=await r.json();if(!r.ok)throw Error(data.error);const fresh=catalogSchema.parse(data);
 // Retain selected places absent from the capped fresh list; their older evidence stays dated.
 const referenced=new Set(trip.items.flatMap(i=>[i.placeId,i.fromId,i.toId].filter((id):id is string=>!!id))),missing=trip.catalog!.places.filter(p=>referenced.has(p.id)&&!fresh.places.some(q=>q.id===p.id));
 const fields=['walkMin','walkM','stairs','seat','foods','cost','hours','situations'] as const;const places=fresh.places.map(p=>{const old=trip.catalog!.places.find(q=>q.id===p.id);if(!old)return p;const merged={...p};for(const field of fields)if(old[field].checked==='user')Object.assign(merged,{[field]:old[field]});return merged;});
 apply({...fresh,places:[...places,...missing],routes:trip.catalog!.routes.filter(r=>[...fresh.places,...missing].some(p=>p.id===r.fromId)&&[...fresh.places,...missing].some(p=>p.id===r.toId))});setMessage(`${fresh.places.length}개 장소 자료를 갱신했습니다.${missing.length?` 최신 후보에 없는 일정 장소 ${missing.length}개는 기존 수집 시각을 유지합니다.`:''}`);
 }catch(e){setMessage(e instanceof Error?e.message:'장소 갱신에 실패했습니다.');}finally{setBusy(false);}}
 async function lookup(force=false){setBusy(true);setMessage('');const routes=[...trip.catalog!.routes];let count=0;try{
 await session();const seen=new Set<string>();
 for(const move of trip.items.filter(i=>i.kind==='move'&&i.fromId&&i.toId&&i.transport)){
  const id=`r:${move.fromId}:${move.toId}:${move.transport}`;if(seen.has(id))continue;seen.add(id);
  const old=routes.find(r=>r.id===id),at=old?.duration.collectedAt;
  if(!force&&old&&at&&Date.now()-Date.parse(at)<86400000)continue;
  const res=await fetch('/api/catalog',{method:'POST',headers,body:JSON.stringify({region:trip.basics.region,fromId:move.fromId,toId:move.toId,transport:move.transport,tripId:trip.id,cloudId})}),data=await res.json();if(!res.ok)throw Error(data.error);const route=routeSchema.parse(data),index=routes.findIndex(r=>r.id===route.id);if(index>=0)routes[index]=route;else routes.push(route);count++;
 }
 setMessage(`${count}개 경로를 조회했습니다. 배정 시간은 유지하며 부족한 시간·미확인 계단·비용을 다시 점검합니다.`);
 }catch(e){setMessage(e instanceof Error?e.message:'경로 조회에 실패했습니다.');}finally{if(count)apply({...trip.catalog!,routes});setBusy(false);}}
 return <section className="cloud-panel no-print"><h2>실제 이동 경로 확인</h2><div className="schedule-actions"><button className="secondary" disabled={busy} onClick={()=>lookup()}>{busy?'자료 확인 중…':'미확인·하루 지난 경로 조회'}</button><button className="secondary" disabled={busy} onClick={()=>lookup(true)}>모든 이동 경로 다시 조회</button><button className="secondary" disabled={busy} onClick={refreshPlaces}>실제 장소 자료 새로고침</button></div>{message&&<p role="status">{message}</p>}<p>실제 도로 경로의 시간·거리만 조회합니다. 내부 보행·계단·택시 요금은 별도 확인이 필요합니다. 배정한 시간과 고정 일정은 유지됩니다.</p></section>;
}

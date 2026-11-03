'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Trip} from '../domain/schema';
import {parseRoadRoute,roadFact,roadURL,type RoadRoute} from '../domain/road-route';
import {publicTravelJSON} from '../adapters/public-travel';
import RoadMap from './RoadMap';
export default function LiveRoadRoute({trip,onTrip}:{trip:Trip;onTrip:(t:Trip)=>void}){
  const moves=useMemo(()=>trip.items.flatMap(i=>{
    if(i.kind!=='move'||!['taxi','driving'].includes(i.transport??''))return [];
    const from=trip.catalog?.places.find(p=>p.id===i.fromId),to=trip.catalog?.places.find(p=>p.id===i.toId);
    return from?.latitude!==undefined&&from.longitude!==undefined&&to?.latitude!==undefined&&to.longitude!==undefined?[{item:i,from,to}]:[];
  }),[trip]);
  const [selected,setSelected]=useState(''),[result,setResult]=useState<{key:string;route:RoadRoute}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const move=moves.find(m=>m.item.id===selected)??moves[0];
  const key=JSON.stringify([trip.id,move?.item.id,move?.item.transport,move?.from.latitude,move?.from.longitude,move?.to.latitude,move?.to.longitude]);
  const latest=useRef(key);latest.current=key;const controller=useRef<AbortController|null>(null),lastRequest=useRef(0);
  useEffect(()=>{controller.current?.abort();setBusy(false);setResult(null);setMessage('');return()=>controller.current?.abort();},[key]);
  if(trip.basics.mode!=='real')return null;
  async function lookup(){if(!move)return;if(Date.now()-lastRequest.current<2000){setMessage('잠시 후 다시 조회하세요.');return;}
    lastRequest.current=Date.now();const c=new AbortController();controller.current=c;setBusy(true);setResult(null);setMessage('');
    try{const route=parseRoadRoute(await publicTravelJSON(roadURL(move.from,move.to),c.signal),move.from,move.to);if(!c.signal.aborted&&latest.current===key)setResult({key,route});}
    catch(e){if(!c.signal.aborted)setMessage(e instanceof Error?e.message:'경로 조회 실패');}
    finally{if(!c.signal.aborted)setBusy(false);}
  }
  const r=result?.key===key?result.route:null;
  function apply(){if(!r||!move||!trip.catalog)return;if(Date.now()-Date.parse(r.fetchedAt)>3600000){setMessage('경로를 다시 조회한 뒤 적용하세요.');return;}
    const fact=roadFact(r,move.from,move.to,move.item.transport as 'taxi'|'driving');
    onTrip({...trip,revision:trip.revision+1,catalog:{...trip.catalog,routes:[...trip.catalog.routes.filter(v=>v.id!==fact.id),fact]}});
    setMessage('조회한 도로 예상 시간을 일정 점검에 반영했습니다. 배정한 시간표는 그대로 유지합니다.');
  }
  return <section className="cloud-panel live-road-route"><h2>자동차 도로 경로</h2><p>선택한 두 장소 사이의 도로와 예상 이동 시간을 확인하세요. 조회 시 장소 좌표를 OSRM에 전송하고 OpenStreetMap 지도를 불러옵니다.</p>
    {move?<><label>확인할 차량 이동 구간<select value={move.item.id} disabled={busy} onChange={e=>setSelected(e.target.value)}>{moves.map(m=><option key={m.item.id} value={m.item.id}>{m.item.day}일차 · {m.from.name} → {m.to.name}</option>)}</select></label><button type="button" disabled={busy} onClick={lookup}>{busy?'도로 경로 조회 중…':'API 키 없이 도로 경로 조회'}</button>{busy&&<button type="button" onClick={()=>{controller.current?.abort();setBusy(false);setMessage('경로 조회를 취소했습니다.');}}>도로 조회 취소</button>}
    {r&&<><RoadMap from={move.from} to={move.to} route={r}/><p>도로 거리 {(r.distance/1000).toFixed(2)}km · 자동차 예상 {Math.ceil(r.seconds/60)}분</p><p>장소와 자동차 도로 연결점 사이: 출발 약 {Math.round(r.fromAccess)}m · 도착 약 {Math.round(r.toAccess)}m. 주차·승하차 위치·이 구간의 보행은 별도 확인하세요.</p><p>조회 {new Date(r.fetchedAt).toLocaleString('ko-KR')}</p><button type="button" onClick={apply}>도로 예상 시간을 일정 점검에 반영</button></>}</>:<p>좌표가 있는 택시·자가용 이동 구간이 필요합니다. 장소를 골라 일정을 먼저 만드세요.</p>}
    <p role="status">{message}</p><p>공개 OSRM 서버의 자동차 예상 경로입니다. 실시간 교통·택시 요금·통행 제한을 보장하지 않습니다. 방문 순서 계산은 여전히 직선거리 기준입니다. 조회 실패 시 다시 시도하거나 외부 지도에서 확인하세요.</p>
  </section>;
}

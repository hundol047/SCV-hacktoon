'use client';
import {useEffect,useRef,useState} from 'react';
import {localInstant,destinationFor,freshAt} from '../domain/world';
import {dayDate} from '../domain/schema';
import {Trip} from '../domain/schema';
import {catalogSchema,routeSchema} from '../data/catalog';
import {refreshCatalog} from '../domain/catalog-refresh';
import {mapDirections} from '../domain/travel-links';
export default function RouteLookup({trip,onTrip,cloudId,accessToken}:{trip:Trip;onTrip:(trip:Trip)=>void;cloudId?:string;accessToken?:string}){
 const latest=useRef(trip);latest.current=trip;const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[region,setRegion]=useState(trip.catalog?.cities?.[0]?.region??trip.basics.region);
 useEffect(()=>setRegion(trip.catalog?.cities?.[0]?.region??trip.basics.region),[trip.id]);
 if(trip.basics.mode!=='real'||!trip.catalog)return null;
 if(typeof window!=='undefined'&&window.BopokAndroid)return <section className="cloud-panel no-print"><h2>지도에서 이동 경로 확인</h2><ExternalDirections trip={trip}/><p>이 APK에는 도로 경로 조회 서버가 연결되지 않았습니다. 지도 링크에서 각 구간을 확인하세요. 택시 호출·확정 요금 기능은 아닙니다.</p></section>;
 const headers={'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})};
 async function session(){const response=await fetch('/api/session',{method:'POST'});if(!response.ok)throw Error('실제 정보 조회에는 서버 세션 연결이 필요합니다.');}
 function apply(catalog:NonNullable<Trip['catalog']>){if(latest.current.id!==trip.id||latest.current.revision!==trip.revision){setMessage('조회 중 일정이 변경되어 이전 응답을 적용하지 않았습니다.');return false;}onTrip({...trip,catalog,revision:trip.revision+1});return true;}
 async function refreshPlaces(){setBusy(true);setMessage('');try{await session();const r=await fetch('/api/catalog',{method:'POST',headers,body:JSON.stringify({action:'refresh',region,limit:trip.catalog?.cities?.find(c=>c.region===region)?.limit??30,radius:trip.catalog?.cities?.find(c=>c.region===region)?.radius??10000})}),data=await r.json();if(!r.ok)throw Error(data.error);const fresh=catalogSchema.parse(data);
 const merged=refreshCatalog(trip,fresh,region),retained=merged.places.filter(p=>!fresh.places.some(q=>q.id===p.id)&&(p.region??trip.catalog!.region)===region).length;
 if(apply(merged))setMessage(`${fresh.places.length}개 장소 자료를 조회했습니다. 현재 일정과 되돌리기에 필요한 장소를 보존했습니다.${retained?` 최신 후보에 없는 ${retained}개 장소는 기존 수집 시각을 유지합니다.`:''}${merged.places.length===2000?' 전체 후보 한도에서 일정에 필요한 장소를 우선 보관합니다.':''}`);
 }catch(e){setMessage(e instanceof Error?e.message:'장소 갱신에 실패했습니다.');}finally{setBusy(false);}}
 async function lookup(force=false){setBusy(true);setMessage('');const routes=[...trip.catalog!.routes];let count=0;try{
 await session();const seen=new Set<string>();
 for(const move of trip.items.filter(i=>i.kind==='move'&&i.fromId&&i.toId&&i.transport)){
  const departureAt=move.transport==='transit'?localInstant(dayDate(trip.basics,move.day),move.start,destinationFor(trip.basics,move.day)?.timezone??trip.basics.timezone):undefined;const id=`r:${move.fromId}:${move.toId}:${move.transport}${departureAt?':'+departureAt:''}`;if(seen.has(id))continue;seen.add(id);
  const old=routes.find(r=>r.id===id),at=old?.duration.collectedAt;
  if(!force&&old&&freshAt(at,86400000))continue;
  const res=await fetch('/api/catalog',{method:'POST',headers,body:JSON.stringify({region:trip.catalog!.places.find(p=>p.id===move.fromId)?.region??trip.basics.region,cacheKey:trip.catalog!.cities?.find(c=>c.region===trip.catalog!.places.find(p=>p.id===move.fromId)?.region)?.cacheKey,fromId:move.fromId,toId:move.toId,transport:move.transport,departureAt,tripId:trip.id,cloudId})}),data=await res.json();if(!res.ok)throw Error(data.error);const route=routeSchema.parse(data),index=routes.findIndex(r=>r.id===route.id);if(index>=0)routes[index]=route;else routes.push(route);count++;
 }
 setMessage(`${count}개 경로를 조회했습니다. 배정 시간은 유지하며 부족한 시간·미확인 계단·비용을 다시 점검합니다.`);
 }catch(e){setMessage(e instanceof Error?e.message:'경로 조회에 실패했습니다.');}finally{if(count)apply({...trip.catalog!,routes});setBusy(false);}}
 return <section className="cloud-panel no-print"><h2>실제 이동 경로 확인</h2><ExternalDirections trip={trip}/>{trip.catalog.cities&&trip.catalog.cities.length>1&&<label>다시 조회할 도시<select value={region} onChange={e=>setRegion(e.target.value)}>{trip.catalog.cities.map(c=><option key={c.region}>{c.region}</option>)}</select></label>}<div className="schedule-actions"><button className="secondary" disabled={busy} onClick={()=>lookup()}>{busy?'자료 확인 중…':'미확인·하루 지난 경로 조회'}</button><button className="secondary" disabled={busy} onClick={()=>lookup(true)}>모든 이동 경로 다시 조회</button><button className="secondary" disabled={busy} onClick={refreshPlaces}>실제 장소 자료 새로고침</button></div>{message&&<p role="status">{message}</p>}<p>실제 도로 경로의 시간·거리만 조회합니다. 내부 보행·계단·택시 요금은 별도 확인이 필요합니다. 배정한 시간과 고정 일정은 유지됩니다.</p></section>;
}

function ExternalDirections({trip}:{trip:Trip}){
 const links=trip.items.flatMap(item=>{
  if(item.kind!=='move'||!item.transport)return [];
  const from=trip.catalog?.places.find(p=>p.id===item.fromId),to=trip.catalog?.places.find(p=>p.id===item.toId);
  if(!from||!to)return [];
  const href=mapDirections(from,to,item.transport);
  return href?[{id:item.id,day:item.day,from:from.name,to:to.name,href}]:[];
 });
 return links.length?<details><summary>구간별 외부 지도 길찾기 ({links.length}개)</summary><p>선택한 구간의 좌표를 지도 서비스에 전달합니다. 지역에 따라 길찾기 지원 범위가 다릅니다.</p><ul>{links.map(link=><li key={link.id}><a href={link.href} target="_blank" rel="noreferrer">{link.day}일차 · {link.from} → {link.to}</a></li>)}</ul></details>:<p>출발·도착 좌표가 있는 이동 구간을 일정에 추가하면 지도 링크가 표시됩니다.</p>;
}

'use client';
import {useState} from 'react';
import type {Trip} from '../domain/schema';
import {planMetrics} from '../domain/plan-metrics';
export default function PlanChangePreview({trip,candidate,onTrip,onClose}:{trip:Trip;candidate:Trip;onTrip:(t:Trip)=>void;onClose:()=>void}){
 const stale=candidate.revision!==trip.revision+1;
 const a=planMetrics(trip),b=planMetrics(candidate),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function propose(){if(stale)return;setBusy(true);try{const r=await fetch('/api/live-trip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'propose',token:trip.basics.liveToken,trip:candidate,expected:trip.revision})});const d=await r.json();if(!r.ok)throw Error(d.error);setMessage('변경안을 보냈습니다. 공유 화면에서 동행자가 투표한 뒤 아래 실시간 공유에서 확정하세요.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="travel-panel" aria-label="일정 변경 미리보기"><h4>변경 전 → 변경 후</h4>{stale&&<p role="status">원본 일정이 변경되었습니다. 다시 계산한 뒤 적용하세요.</p>}<p>예상 비용 {a.cost.toLocaleString()}원 → {b.cost.toLocaleString()}원<br/>도로 이동 {a.travel}분 → {b.travel}분 · 관광 {a.visits}곳 → {b.visits}곳 · 휴식 {a.rest}분 → {b.rest}분</p>{candidate.basics.tripBudget!==undefined&&<p>{b.cost>candidate.basics.tripBudget?`예산보다 ${(b.cost-candidate.basics.tripBudget).toLocaleString()}원 높습니다.`:'입력한 예산 안의 예상 비용입니다.'}</p>}<ul>{Array.from({length:candidate.basics.days},(_,i)=><li key={i}>{i+1}일차: {candidate.items.filter(v=>v.day===i+1&&(v.kind==='visit'||v.label==='체크인')).map(v=>candidate.catalog?.places.find(p=>p.id===v.placeId)?.name).join(' → ')}</li>)}</ul><p>도로 시간은 교통 정체를 반영하지 않으며, 비용은 저장한 단가와 할인 조건 기준입니다.</p>{trip.basics.liveToken?<button disabled={busy||stale} onClick={propose}>동행자에게 변경안 보내기</button>:<button disabled={stale} onClick={()=>{onTrip(candidate);onClose();}}>변경 일정 적용</button>} <button className="text-button" onClick={onClose}>닫기</button>{message&&<p role="status">{message}</p>}</section>;
}

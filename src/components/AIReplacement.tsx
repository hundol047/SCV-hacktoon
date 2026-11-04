'use client';
import {useEffect,useRef,useState} from 'react';
import {placeMapLink} from '../domain/place-map';
import {placeSimilarity} from '../domain/place-similarity';
import type {Trip} from '../domain/schema';
import {catalogFor} from '../data/catalog';
import {applyReplacement,replacementInput,replacementInstructions,validateReplacements} from '../domain/replacements';

type Result=ReturnType<typeof validateReplacements>;
export default function AIReplacement({trip,onTrip}:{trip:Trip;onTrip:(t:Trip)=>void}){
  const [item,setItem]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[results,setResults]=useState<Result>([]);
  const version=useRef(0);useEffect(()=>()=>{version.current++;},[]);
  const catalog=catalogFor(trip.basics.mode,trip.catalog);
  const original=catalog.places.find(p=>p.id===trip.items.find(i=>i.id===item)?.placeId);
  const visits=trip.items.filter(i=>i.kind==='visit'&&!i.locked);
  const fact=(v:boolean|null)=>v===null?'미확인':v?'있음':'없음';
  async function recommend(){
    const revision=++version.current;setBusy(true);setResults([]);setMessage('');
    try{
      if(!consent)throw Error('외부 전송과 API 사용료에 동의해 주세요.');
      const input=replacementInput(trip,item);let raw:unknown;
        const r=await fetch('/api/replacements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trip,itemId:item,consent:true})});const data=await r.json();if(!r.ok)throw Error(data.error);raw=data;
      if(revision!==version.current)return;
      const checked=validateReplacements(trip,item,raw);setResults(checked);setMessage(checked.length?'마음에 드는 관광지를 선택하세요.':'AI가 대체 후보를 추천하지 않았습니다.');
    }catch(e){if(revision===version.current)setMessage(e instanceof Error?e.message:'AI 연결 실패');}
    finally{if(revision===version.current)setBusy(false);}
  }
  return <details className="cloud-panel"><summary>AI 대체 관광지 추천</summary>
    <ol className="journey-steps"><li>1. 바꿀 장소 선택</li><li>2. AI 추천 받기</li><li>3. 비교 후 직접 적용</li></ol>
    <p>여행 취향에 맞는 다른 관광지를 추천합니다. 마음에 드는 장소를 골라 일정에 적용하세요.</p>
    {trip.basics.taxiPlan&&<p>교체하면 해당 날짜의 이동 순서를 다시 확인하세요.</p>}
    {!visits.length&&<p>바꿀 수 있는 관광 일정이 없습니다. 관광지를 추가하거나 해당 일정의 고정을 해제하세요.</p>}
    <label>교체할 관광 일정<select value={item} disabled={busy||!visits.length} onChange={e=>{version.current++;setItem(e.target.value);setResults([]);setMessage('');}}><option value="">관광지를 선택하세요</option>{visits.map(i=><option key={i.id} value={i.id}>{i.day}일차 · {catalog.places.find(p=>p.id===i.placeId)?.name??i.placeId}</option>)}</select></label>
    <label className="check-row"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>{setConsent(e.target.checked);setResults([]);}}/>여행 조건을 보내 AI 추천 받기에 동의합니다.</label>
    <button type="button" disabled={!item||!consent||busy} onClick={recommend}>{busy?'AI 추천 요청 중…':'대체 관광지 AI 추천'}</button>
    <button type="button" disabled={!item||busy} onClick={()=>{try{const input=replacementInput(trip,item);setResults(validateReplacements(trip,item,{candidateIds:input.candidates.slice(0,3).map(p=>p.id)}));setMessage('기본 유사 추천 · 등록 테마·실내외·보행 자료 비교입니다. AI 호출 없이 추천했습니다.');}catch(e){setResults([]);setMessage(e instanceof Error?e.message:'추천 실패');}}}>비슷한 관광지 기본 추천</button>
    {results.map(r=><article key={r.place.id}><h3>{r.place.name}</h3>{original&&<p>{placeSimilarity(original,r.place).reasons.join(' · ')}</p>}{r.place.description!=='한국관광공사 관광정보'&&<p>{r.place.description}</p>}{r.place.visitorInfo?.address&&<p>{r.place.visitorInfo.address}</p>}<a href={placeMapLink(r.place)} target="_blank" rel="noreferrer">지도 보기</a>{r.report.issues.some(i=>i.status==='violation'||i.status==='conflict')&&<p>현재 조건과 맞지 않는 항목이 있어 다른 장소를 선택해 주세요.</p>}<button type="button" onClick={()=>{try{onTrip(applyReplacement(trip,item,r.place.id));}catch(e){setMessage(e instanceof Error?e.message:'적용 실패');}}}>이 관광지로 교체</button></article>)}
    <p role="status">{message}</p>
  </details>;
}

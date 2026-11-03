'use client';
import {useEffect,useRef,useState} from 'react';
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
      const checked=validateReplacements(trip,item,raw);setResults(checked);setMessage(checked.length?'AI 추천을 받았습니다. 미확인 정보와 적용 결과를 확인하고 선택해 주세요.':'AI가 대체 후보를 추천하지 않았습니다.');
    }catch(e){if(revision===version.current)setMessage(e instanceof Error?e.message:'AI 연결 실패');}
    finally{if(revision===version.current)setBusy(false);}
  }
  return <details className="cloud-panel"><summary>AI 대체 관광지 추천</summary>
    <ol className="journey-steps"><li>1. 바꿀 장소 선택</li><li>2. AI 추천 받기</li><li>3. 비교 후 직접 적용</li></ol>
    <p>여행 조건과 후보 장소를 Amazon Bedrock에 전송해 대체 관광지를 추천받습니다. 선택한 후보만 적용하며 고정 일정은 유지합니다. API 사용료가 발생합니다.</p>
    {trip.basics.taxiPlan&&<p>관광지를 바꾸면 해당 날짜의 차량 순서·비용 가정 결과를 해제합니다. 교체 후 동선과 비용을 다시 확인하세요.</p>}
    {!visits.length&&<p>바꿀 수 있는 관광 일정이 없습니다. 관광지를 추가하거나 해당 일정의 고정을 해제하세요.</p>}
    <label>교체할 관광 일정<select value={item} disabled={busy||!visits.length} onChange={e=>{version.current++;setItem(e.target.value);setResults([]);setMessage('');}}><option value="">관광지를 선택하세요</option>{visits.map(i=><option key={i.id} value={i.id}>{i.day}일차 · {catalog.places.find(p=>p.id===i.placeId)?.name??i.placeId}</option>)}</select></label>
    <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>{setConsent(e.target.checked);setResults([]);}}/>여행 조건·후보의 외부 전송과 API 사용료에 동의합니다.</label>
    <button type="button" disabled={!item||!consent||busy} onClick={recommend}>{busy?'AI 추천 요청 중…':'대체 관광지 AI 추천'}</button>
    <button type="button" disabled={!item||busy} onClick={()=>{try{const input=replacementInput(trip,item);setResults(validateReplacements(trip,item,{candidateIds:input.candidates.slice(0,3).map(p=>p.id)}));setMessage('기본 유사 추천 · 등록 테마·실내외·보행 자료 비교입니다. AI 호출 없이 추천했습니다.');}catch(e){setResults([]);setMessage(e instanceof Error?e.message:'추천 실패');}}}>비슷한 관광지 기본 추천</button>
    {results.map(r=><article key={r.place.id}><h3>{r.place.name}</h3>{original&&<p>{placeSimilarity(original,r.place).reasons.join(' · ')}</p>}<p>{r.place.description}</p><table className="ai-comparison"><caption>교체 전후 비교 · 미확인은 확인된 사실이 아닙니다</caption><thead><tr><th scope="col">항목</th><th scope="col">현재 장소</th><th scope="col">추천 장소</th></tr></thead><tbody><tr><th scope="row">이름</th><td>{original?.name??'미확인'}</td><td>{r.place.name}</td></tr><tr><th scope="row">내부 보행</th><td>{original?.walkMin.value==null?'미확인':`${original.walkMin.value}분`}</td><td>{r.place.walkMin.value===null?'미확인':`${r.place.walkMin.value}분`}</td></tr><tr><th scope="row">계단</th><td>{fact(original?.stairs.value??null)}</td><td>{fact(r.place.stairs.value)}</td></tr><tr><th scope="row">좌석</th><td>{fact(original?.seat.value??null)}</td><td>{fact(r.place.seat.value)}</td></tr></tbody></table><p>교체 후 미확인 항목 {r.report.issues.filter(i=>i.status==='unknown').length}개. 배정 시간은 유지됩니다. 연결 경로를 다시 확인하세요.</p><details><summary>교체 후 확인할 항목</summary><ul>{r.report.issues.filter(i=>i.status==='unknown').map((issue,n)=><li key={n}>{issue.message}</li>)}</ul></details><button type="button" onClick={()=>{try{onTrip(applyReplacement(trip,item,r.place.id));}catch(e){setMessage(e instanceof Error?e.message:'적용 실패');}}}>이 관광지로 교체</button></article>)}
    <p role="status">{message}</p>
  </details>;
}

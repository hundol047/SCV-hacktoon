'use client';
import {useEffect,useRef,useState} from 'react';
import type {Trip} from '../domain/schema';
import {catalogFor} from '../data/catalog';
import {applyReplacement,replacementInput,replacementInstructions,validateReplacements} from '../domain/replacements';

type Result=ReturnType<typeof validateReplacements>;
export default function AIReplacement({trip,onTrip}:{trip:Trip;onTrip:(t:Trip)=>void}){
  const [item,setItem]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[results,setResults]=useState<Result>([]);
  const version=useRef(0);useEffect(()=>()=>{version.current++;},[]);
  const [key,setKey]=useState(''),[model,setModel]=useState('gpt-4.1-mini'),[configured,setConfigured]=useState(false);
  const bridge=typeof window!=='undefined'?window.BopokAndroid:undefined;
  const catalog=catalogFor(trip.basics.mode,trip.catalog);
  const original=catalog.places.find(p=>p.id===trip.items.find(i=>i.id===item)?.placeId);
  const visits=trip.items.filter(i=>i.kind==='visit'&&!i.locked);
  const fact=(v:boolean|null)=>v===null?'미확인':v?'있음':'없음';
  useEffect(()=>{if(bridge?.aiStatus){try{const s=JSON.parse(bridge.aiStatus());setConfigured(s.configured);if(s.model)setModel(s.model);}catch{}}},[bridge]);
  function configure(){try{bridge!.configureAI(key.trim(),model.trim());setKey('');const s=JSON.parse(bridge!.aiStatus());setConfigured(s.configured);setMessage(s.configured?'API 키를 휴대폰에 암호화 저장했습니다. 추천을 요청하면 실제 연결을 확인합니다.':'키가 삭제되었습니다.');}catch{setMessage('키·모델 입력 또는 기기 암호화 저장소를 확인해 주세요.');}}
  async function recommend(){
    const revision=++version.current;setBusy(true);setResults([]);setMessage('');
    try{
      if(!consent)throw Error('외부 전송과 API 사용료에 동의해 주세요.');
      const input=replacementInput(trip,item);let raw:unknown;
      if(bridge?.requestAI){
        if(!configured)throw Error('OpenAI API 키를 먼저 등록해 주세요.');
        raw=await new Promise((resolve,reject)=>{
          const id=crypto.randomUUID();const timer=setTimeout(()=>{window.removeEventListener('bopok:ai',receive);reject(Error('AI 응답 시간이 초과되었습니다.'));},45000);
          function receive(event:Event){const data=(event as CustomEvent).detail;if(data.id!==id)return;clearTimeout(timer);window.removeEventListener('bopok:ai',receive);if(data.error)reject(Error(data.error));else resolve(data.output);}
          window.addEventListener('bopok:ai',receive);
          bridge.requestAI(id,JSON.stringify({input:input.text,instructions:replacementInstructions,candidateIds:input.candidates.map(p=>p.id)}));
        });
      }else{
        const r=await fetch('/api/replacements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trip,itemId:item,consent:true})});const data=await r.json();if(!r.ok)throw Error(data.error);raw=data;
      }
      if(revision!==version.current)return;
      const checked=validateReplacements(trip,item,raw);setResults(checked);setMessage(checked.length?'AI 추천을 받았습니다. 미확인 정보와 적용 결과를 확인하고 선택해 주세요.':'AI가 대체 후보를 추천하지 않았습니다.');
    }catch(e){if(revision===version.current)setMessage(e instanceof Error?e.message:'AI 연결 실패');}
    finally{if(revision===version.current)setBusy(false);}
  }
  return <details className="cloud-panel"><summary>AI 대체 관광지 추천</summary>
    <ol className="journey-steps"><li>1. 바꿀 장소 선택</li><li>2. AI 추천 받기</li><li>3. 비교 후 직접 적용</li></ol>
    <p>여행 조건과 후보 장소를 OpenAI에 전송해 대체 관광지를 추천받습니다. 선택한 후보만 적용하며 고정 일정은 유지합니다. API 사용료가 발생합니다.</p>
    {trip.basics.taxiPlan&&<p>관광지를 바꾸면 저장된 택시 순서·요금 가정 결과를 해제합니다. 교체 후 택시 동선과 요금을 다시 확인하세요.</p>}
    {bridge?.configureAI&&<fieldset><legend>개인 OpenAI 연결</legend><p>{configured?'키 등록됨 · 실제 연결은 추천 요청 시 확인':'API 키 미등록'}</p><label>OpenAI API 키<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="휴대폰에만 암호화 저장"/></label><label>OpenAI 모델<input value={model} onChange={e=>setModel(e.target.value)}/></label><button type="button" disabled={busy||!key.trim()} onClick={configure}>키와 모델 저장</button><button type="button" disabled={busy} onClick={()=>{bridge.configureAI('',model);setKey('');setConfigured(false);setResults([]);setMessage('저장된 API 키를 삭제했습니다.');}}>API 키 삭제</button><p>키는 채팅에 보내지 마세요. 하루 최대 20회 요청하며, OpenAI 계정에서도 사용 한도를 설정하세요.</p></fieldset>}
    {!visits.length&&<p>바꿀 수 있는 관광 일정이 없습니다. 관광지를 추가하거나 해당 일정의 고정을 해제하세요.</p>}
    <label>교체할 관광 일정<select value={item} disabled={busy||!visits.length} onChange={e=>{version.current++;setItem(e.target.value);setResults([]);setMessage('');}}><option value="">관광지를 선택하세요</option>{visits.map(i=><option key={i.id} value={i.id}>{i.day}일차 · {catalog.places.find(p=>p.id===i.placeId)?.name??i.placeId}</option>)}</select></label>
    <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>{setConsent(e.target.checked);setResults([]);}}/>여행 조건·후보의 외부 전송과 API 사용료에 동의합니다.</label>
    {bridge?.requestAI&&!configured&&<p>API 키를 등록한 뒤 추천할 수 있습니다. 키 없이도 직접 일정 편집과 택시 순서 계산은 가능합니다.</p>}
    <button type="button" disabled={!item||!consent||busy||!!bridge?.requestAI&&!configured} onClick={recommend}>{busy?'AI 추천 요청 중…':'대체 관광지 AI 추천'}</button>
    {results.map(r=><article key={r.place.id}><h3>{r.place.name}</h3><p>{r.place.description}</p><table className="ai-comparison"><caption>교체 전후 비교 · 미확인은 확인된 사실이 아닙니다</caption><thead><tr><th scope="col">항목</th><th scope="col">현재 장소</th><th scope="col">추천 장소</th></tr></thead><tbody><tr><th scope="row">이름</th><td>{original?.name??'미확인'}</td><td>{r.place.name}</td></tr><tr><th scope="row">내부 보행</th><td>{original?.walkMin.value==null?'미확인':`${original.walkMin.value}분`}</td><td>{r.place.walkMin.value===null?'미확인':`${r.place.walkMin.value}분`}</td></tr><tr><th scope="row">계단</th><td>{fact(original?.stairs.value??null)}</td><td>{fact(r.place.stairs.value)}</td></tr><tr><th scope="row">좌석</th><td>{fact(original?.seat.value??null)}</td><td>{fact(r.place.seat.value)}</td></tr></tbody></table><p>교체 후 미확인 항목 {r.report.issues.filter(i=>i.status==='unknown').length}개. 배정 시간은 유지됩니다. 연결 경로를 다시 확인하세요.</p><details><summary>교체 후 확인할 항목</summary><ul>{r.report.issues.filter(i=>i.status==='unknown').map((issue,n)=><li key={n}>{issue.message}</li>)}</ul></details><button type="button" onClick={()=>{try{onTrip(applyReplacement(trip,item,r.place.id));}catch(e){setMessage(e instanceof Error?e.message:'적용 실패');}}}>이 관광지로 교체</button></article>)}
    <p role="status">{message}</p>
  </details>;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import {savePlan,removePlan,savedPlans} from '../domain/course-plans';
import {weatherLabels,weatherGuidance,type Weather} from '../domain/weather';
import {dayDate} from '../domain/schema';
import type {Basics,Conditions} from '../domain/schema';
import type {Catalog} from '../data/catalog';
import {courseInput,courseInstructions,regionalCourse} from '../domain/regional-course';

type Props={basics:Basics;conditions:Conditions;catalog:Catalog;onChange:(b:Basics)=>void};
export default function RegionalCourse(props:Props){
  const [day,setDay]=useState(1);
  return <Course day={Math.min(day,props.basics.days)} setDay={setDay} key={JSON.stringify([props.basics,props.conditions,props.catalog])} {...props}/>;
}
function Course({basics,conditions,catalog,onChange,day,setDay}:Props&{day:number;setDay:(day:number)=>void}){
  const [busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[message,setMessage]=useState('');
  const [result,setResult]=useState<ReturnType<typeof regionalCourse>|null>(null),[method,setMethod]=useState('');
  const [key,setKey]=useState(''),[model,setModel]=useState('gpt-4.1-mini'),[configured,setConfigured]=useState(false);
  const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const bridge=typeof window!=='undefined'?window.BopokAndroid:undefined;
  useEffect(()=>{try{const s=bridge?.aiStatus&&JSON.parse(bridge.aiStatus());if(s){setConfigured(s.configured);setModel(s.model);}}catch{}},[bridge]);
  const pref=basics.coursePreferences?.find(p=>p.day===day);
  const region=basics.destinations?.find(d=>d.startDay<=day&&d.endDay>=day)?.region??basics.region;
  const local=catalog.places.filter(p=>(p.region??catalog.region)===region&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));
  const originId=pref?.originId??local.find(p=>p.kind==='visit')?.id??'';
  function preference(change:Partial<NonNullable<Basics['coursePreferences']>[number]>){
    onChange({...removePlan(basics,day),coursePreferences:[...(basics.coursePreferences??[]).filter(p=>p.day!==day),{day,weather:'unknown',visitMinutes:60,originId,...pref,...change}]});
  }
  async function recommend(ai:boolean){
    setBusy(true);setResult(null);setMessage('');
    try{
      const input=courseInput(basics,conditions,catalog,day);let raw:unknown;
      if(!ai)raw={candidateIds:input.candidates.slice(0,3).map(p=>p.place.id)};
      else{
        if(!consent)throw Error('조건·후보 전송과 API 비용에 동의해 주세요.');
        if(bridge?.requestAI){
          if(!configured)throw Error('개인 API 키를 먼저 등록하세요.');
          raw=await new Promise((resolve,reject)=>{
            const id=crypto.randomUUID();
            const timer=setTimeout(()=>{window.removeEventListener('bopok:ai',receive);reject(Error('AI 응답 시간이 초과되었습니다. 다시 요청하세요.'));},45000);
            function receive(event:Event){const data=(event as CustomEvent).detail;if(data.id!==id)return;clearTimeout(timer);window.removeEventListener('bopok:ai',receive);if(data.error)reject(Error(data.error));else resolve(data.output);}
            window.addEventListener('bopok:ai',receive);
            try{bridge.requestAI(id,JSON.stringify({input:input.text,instructions:courseInstructions,candidateIds:input.candidates.map(p=>p.place.id)}));}catch(e){clearTimeout(timer);window.removeEventListener('bopok:ai',receive);reject(e);}
          });
        }else{
          const response=await fetch('/api/courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({basics,conditions,catalog,day,consent:true})});
          const data=await response.json();if(!response.ok)throw Error(data.error);raw=data;
        }
      }
      if(!active.current)return;
      setResult(regionalCourse(basics,conditions,catalog,day,raw));setMethod(ai?'AI 추천':'기본 추천 · 등록 자료와 조건 기준');
    }catch(e){if(active.current)setMessage(e instanceof Error?e.message:'추천 실패');}
    finally{if(active.current)setBusy(false);}
  }
  return <section className="cloud-panel regional-course" aria-label="지역 맞춤 코스 추천"><div className="panel-body">
    <h2>지역 맞춤 코스 추천</h2><p>{basics.region}의 관광지와 선택한 취향·보행 조건을 비교합니다. 먼저 2~3곳의 관광 코스를 확인하고 일정에 적용하세요. 조건에 맞는 식당이 있으면 식사를 넣고 관광 후 휴식을 배정합니다. 영업시간·실제 소요시간은 별도 확인이 필요합니다.</p>
    <label>추천할 여행일<select value={day} disabled={busy} onChange={e=>{setDay(Number(e.target.value));setResult(null);setMessage('');}}>{Array.from({length:basics.days},(_,i)=><option key={i} value={i+1}>{i+1}일차</option>)}</select></label>
    <label>기준 출발 장소<select value={originId} disabled={busy} onChange={e=>preference({originId:e.target.value})}>{local.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <p>이 장소와의 직선거리를 후보 선정에 반영합니다. 출발지에서 첫 관광지까지의 이동은 별도이며, 코스 거리는 관광지 사이 거리입니다.</p>
    <label>여행일 날씨 가정<select value={pref?.weather??'unknown'} disabled={busy} onChange={e=>preference({weather:e.target.value as Weather})}>{Object.entries(weatherLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <p>{dayDate(basics,day)} · 직접 선택한 날씨 가정이며 실시간 예보가 아닙니다. {weatherGuidance[pref?.weather??'unknown']}</p>
    <a href="https://www.weather.go.kr/" target="_blank" rel="noreferrer">기상청 예보·특보 확인</a>
    <label>관광지당 체류 시간<select value={pref?.visitMinutes??60} disabled={busy} onChange={e=>preference({visitMinutes:Number(e.target.value)})}>{[30,45,60,90,120].map(m=><option key={m} value={m}>{m}분</option>)}</select></label>
    {bridge?.configureAI&&<details><summary>AI 연결 설정</summary><p>{configured?'키 등록됨 · 실제 연결은 요청 시 확인':'API 키 미등록 · 기본 추천은 바로 이용 가능'}</p><label>코스 추천 OpenAI API 키<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)}/></label><label>코스 추천 모델<input value={model} onChange={e=>setModel(e.target.value)}/></label><button type="button" disabled={busy||!key.trim()} onClick={()=>{try{bridge.configureAI(key.trim(),model.trim());setConfigured(JSON.parse(bridge.aiStatus()).configured);setKey('');setMessage('기기에 키를 암호화 저장했습니다.');}catch{setMessage('키·모델 또는 암호화 저장소를 확인하세요.');}}}>코스 추천 키 저장</button><button type="button" disabled={busy} onClick={()=>{try{bridge.configureAI('',model);setConfigured(false);setKey('');setMessage('API 키를 삭제했습니다.');}catch{setMessage('키 삭제에 실패했습니다.');}}}>코스 추천 키 삭제</button></details>}
    <label className="check-row"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>지역·취향·조건·후보를 OpenAI에 전송하며 API 비용이 발생하는 데 동의합니다.</label>
    <button type="button" className="primary" disabled={busy||pref?.weather==='storm'||!consent||!!bridge?.requestAI&&!configured} onClick={()=>recommend(true)}>{busy?'추천 준비 중…':'AI로 지역 코스 추천'}</button>
    <button type="button" className="secondary" disabled={busy||pref?.weather==='storm'} onClick={()=>recommend(false)}>API 키 없이 기본 코스 보기</button>
    <p>AI 추천은 API 연결이 필요합니다. 기본 추천은 AI를 호출하지 않습니다. 방문 순서는 직선거리 기준이며 실제 경로·비용·운영시간·주차는 미확인입니다.</p>
    {result&&<article className="course-preview"><h3>{method} · {day}일차</h3><ol>{result.places.map(p=><li key={p.id}><strong>{p.name} · {p.kind==='meal'?'식사':'관광'}</strong><p>{result.reasons.find(r=>r.id===p.id)?.text}</p><p>{p.experiences.filter(e=>conditions.experiences.includes(e)).join(' · ')||'지역 후보 중 선택'} · 보행 {p.walkMin.value===null?'미확인':`${p.walkMin.value}분`}</p></li>)}</ol><p>관광 후 휴식 {result.plan.courseOptions.restMinutes}분씩 · 관광 체류 {result.plan.courseOptions.visitMinutes}분씩</p><ul>{result.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul><p>직선 이동 합계 {result.plan.distanceKm.toFixed(1)}km. 적용하면 이 날짜의 기존 방문 순서와 비용 가정은 바뀝니다.</p><button type="button" onClick={()=>onChange(savePlan(basics,result.plan))}>이 코스를 일정에 적용</button></article>}
    {savedPlans(basics).length>0&&<div><h3>날짜별 저장 코스</h3>{savedPlans(basics).map(p=><p key={p.day??1}>{p.day??1}일차 · {p.orderedPlaceIds.length}곳 <button type="button" disabled={busy} onClick={()=>onChange(removePlan(basics,p.day??1))}>{p.day??1}일차 코스 삭제</button></p>)}</div>}
    {basics.taxiPlan&&<p role="status">{basics.taxiPlan.day??1}일차에 {basics.taxiPlan.orderedPlaceIds.length}곳이 선택되어 있습니다. 아래 일정 만들기를 누르면 시간표에 반영됩니다.</p>}
    <p role="status">{message}</p>
  </div></section>;
}

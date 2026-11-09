'use client';
import {useEffect,useRef,useState} from 'react';
import {tripSchema,type Trip} from '../domain/schema';
import {dailyCourseOptions,courseSignature} from '../domain/course-options';
import {savedPlans} from '../domain/course-plans';
export default function DailyCourseOptions({trip,day,onTrip}:{trip:Trip;day:number;onTrip?:(trip:Trip)=>void}){
 const [options]=useState(()=>dailyCourseOptions(trip,day));
 const [busy,setBusy]=useState<number|null>(null),[message,setMessage]=useState('');
 const latest=useRef(trip);latest.current=trip;const active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const selected=courseSignature((savedPlans(trip.basics).find(p=>(p.day??1)===day)?.orderedPlaceIds??[]).filter(id=>trip.catalog?.places.find(p=>p.id===id)?.kind==='visit'));
 async function apply(index:number){if(!onTrip||busy!==null)return;const snapshot=trip;setBusy(index);setMessage('');try{
  const response=await fetch('/api/edit-course',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trip:snapshot,day,ids:options[index].ids})});
  const data=await response.json();if(!response.ok)throw Error(data.error??'코스를 변경하지 못했어요.');
  if(active.current&&latest.current===snapshot){onTrip(tripSchema.parse(data.trip));setMessage('선택한 코스로 이동 시간과 일정을 다시 계산했어요.');}
 }catch(e){if(active.current)setMessage(e instanceof Error?e.message:'코스를 변경하지 못했어요.');}finally{if(active.current)setBusy(null);}}
 if(!options.length||!onTrip)return null;
 return <section className="daily-course-options" aria-label={`${day}일차 코스 선택`}><div className="course-choice-heading"><h3>{day}일차, 마음에 드는 코스를 골라 보세요</h3><span>선택하면 동선도 함께 변경돼요</span></div><div className="course-choice-grid">{options.map((option,index)=><article key={option.signature} className={selected===option.signature?'selected':''}><div><strong>코스 {String.fromCharCode(65+index)}</strong>{selected===option.signature&&<span className="course-selected">선택 중</span>}</div><ol>{option.names.map((name,i)=><li key={option.ids[i]}>{name}</li>)}</ol><button type="button" disabled={busy!==null||selected===option.signature} onClick={()=>apply(index)}>{busy===index?'이동 시간 계산 중…':selected===option.signature?'현재 코스':'이 코스 선택'}</button></article>)}</div>{options.length<3&&<p className="road-note">현재 조건에 맞는 서로 다른 코스는 {options.length}개예요.</p>}{message&&<p role="status">{message}</p>}</section>;
}

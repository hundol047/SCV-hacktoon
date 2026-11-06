'use client';
import {useState} from 'react';
import type {Trip} from '../domain/schema';
import {publicPlan,encodePlan} from '../domain/shared-plan';
import {calendarFile,googleCalendarURL} from '../domain/calendar';
export default function TripShareActions({trip,day,onTrip}:{trip:Trip;day:number;onTrip?:(t:Trip)=>void}){
 const [link,setLink]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function share(snapshot=false){setBusy(true);setMessage('');try{let token=snapshot?undefined:trip.basics.liveToken;if(onTrip&&!token&&!snapshot){const r=await fetch('/api/live-trip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',trip})});const d=await r.json();if(!r.ok)throw Error(d.error);token=d.token;onTrip({...trip,basics:{...trip.basics,liveToken:token,liveRevision:trip.revision}});}const fragment=token?'live='+token:await encodePlan(publicPlan(trip));const origin=window.BopokAndroid?'http://52.65.9.104:8000':window.location.origin;const url=origin+'/shared#'+fragment;setLink(url);
 if(window.BopokAndroid?.shareText){window.BopokAndroid.shareText(trip.basics.title,url);setMessage('공유할 앱을 선택하세요.');}
 else if(navigator.share){try{await navigator.share({title:trip.basics.title,url});}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setMessage('아래 링크를 복사해 공유하세요.');}}
 else{try{await navigator.clipboard.writeText(url);setMessage('공유 링크를 복사했습니다.');}catch{setMessage('아래 링크를 선택해 복사하세요.');}}
 }catch(e){setMessage(e instanceof Error?e.message:'공유 링크를 만들지 못했습니다.');}finally{setBusy(false);}}
 function download(){try{const content=calendarFile(publicPlan(trip));if(window.BopokAndroid?.saveCalendar){window.BopokAndroid.saveCalendar(content);return;}const url=URL.createObjectURL(new Blob([content],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='yeohaengit-itinerary.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch{setMessage('캘린더 파일을 만들지 못했습니다. 날짜와 시간을 확인해 주세요.');}}
 let google:string|null=null;try{google=googleCalendarURL(publicPlan(trip),day);}catch{}
 return <div className="trip-share-actions"><div className="schedule-actions"><button type="button" className="secondary" onClick={()=>share()} disabled={busy}>{busy?'링크 만드는 중…':'일정 공유'}</button><button type="button" className="text-button" disabled={busy} onClick={()=>share(true)}>현재 일정 사본 공유</button>{google&&<a className="secondary" href={google} target="_blank" rel="noreferrer">{day}일차 Google 캘린더 저장</a>}<button type="button" className="text-button" onClick={download}>전체 일정 캘린더 파일</button></div>{link&&<label className="share-link">공유 링크<input readOnly value={link} onFocus={e=>e.currentTarget.select()}/><small>{link.includes('#live=')?'링크를 받은 사람은 출발지·숙소·최신 일정과 비용을 볼 수 있습니다.':'현재 일정의 사본 링크입니다.'}</small></label>}{message&&<p role="status">{message}</p>}</div>;
}

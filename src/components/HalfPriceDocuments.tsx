'use client';
import {useEffect,useState} from 'react';
import {listEvidence} from '../adapters/evidence-storage';
import type {TripEvidence} from '../domain/trip-evidence';
import TripEvidenceUpload from './TripEvidenceUpload';
import type {Trip} from '../domain/schema';
import {halfPriceDocuments} from '../domain/half-price-documents';
export default function HalfPriceDocuments({trip,city}:{trip:Trip;city:string}){
 const [rows,setRows]=useState<TripEvidence[]>([]),[storageError,setStorageError]=useState('');
 useEffect(()=>{let active=true;let version=0;const load=async()=>{const current=++version;try{const saved=await listEvidence(trip.id,city);if(active&&current===version){setRows(saved);setStorageError('');}}catch(e){if(active)setStorageError((e as Error).message);}};void load();window.addEventListener('yeohaengit:evidence',load);return()=>{active=false;window.removeEventListener('yeohaengit:evidence',load);};},[trip.id,city]);
 const [kind,setKind]=useState<'plan'|'settlement'>('plan');
 const [edits,setEdits]=useState<Partial<Record<'plan'|'settlement',{source:string;text:string}>>>({});
 const [message,setMessage]=useState('');
 const generated=halfPriceDocuments(trip,city,rows);const source=generated[kind];const edit=edits[kind];const text=edit?.source===source?edit.text:source;
 async function copy(){try{await navigator.clipboard.writeText(text);setMessage('초안을 복사했어요. 공식 신청 화면에 붙여넣고 확인하세요.');}catch{setMessage('복사가 제한되어 있어요. 아래 글을 선택해 복사하거나 파일로 저장하세요.');}}
 function download(){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`반값여행-${city}-${kind==='plan'?'여행계획':'정산초안'}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('초안 파일을 저장했어요.');}
 return <details className="half-price-documents"><summary>선택한 일정으로 신청 글·서류 준비</summary><p>날짜·방문지·인원을 자동으로 채웠어요. 일정이나 확인한 증빙이 바뀌면 새 초안으로 갱신됩니다. 수정한 내용은 먼저 복사·저장해 주세요.</p>{storageError&&<p role="alert">{storageError}</p>}<TripEvidenceUpload key={trip.id+city} tripId={trip.id} city={city} rows={rows}/><label>작성할 문서<select value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setMessage('');}}><option value="plan">사전신청 여행계획</option><option value="settlement">여행 후 정산 설명</option></select></label><label>신청 글 초안<textarea rows={14} value={text} onChange={e=>{setEdits(v=>({...v,[kind]:{source,text:e.target.value}}));setMessage('');}}/></label><div className="schedule-actions"><button type="button" onClick={copy}>초안 복사</button><button type="button" onClick={download}>텍스트 파일 저장</button><button type="button" onClick={()=>{setEdits(v=>({...v,[kind]:undefined}));setMessage('현재 일정으로 초안을 다시 채웠어요.');}}>현재 일정으로 다시 채우기</button></div><p role="status">{message}</p><small>실제 영수증·방문사진·증명서는 별도로 준비하세요. 이 화면에서 정부 신청처로 자동 전송하지 않습니다.</small></details>;
}

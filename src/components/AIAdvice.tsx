'use client';
import {useState} from 'react';
import {Trip} from '../domain/schema';
export default function AIAdvice({trip}:{trip:Trip}){const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[lines,setLines]=useState<string[]>([]);
 async function explain(){setBusy(true);setMessage('');try{const r=await fetch('/api/advice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trip,consent})});const data=await r.json();if(!r.ok)throw Error(data.error);setLines([...data.candidates.map((p:{name:string})=>'검토 후보: '+p.name),...data.explanations]);setMessage(data.message);}catch(e){setMessage(e instanceof Error?e.message:'설명을 가져오지 못했습니다.');setLines([]);}finally{setBusy(false);}}
 return <details className="cloud-panel no-print"><summary>AI 검토 설명</summary><p>조건·고정 구간·후보 장소·규칙 점검 결과를 OpenAI에 전송하여 검토 후보와 확인 항목을 고릅니다. AI가 시간표나 입력 조건을 자동 변경하지 않습니다.</p><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> 이 설명 요청의 외부 전송에 동의합니다.</label><button className="secondary" disabled={!consent||busy} onClick={explain}>{busy?'AI 설명 요청 중…':'AI 검토 설명 요청'}</button>{message&&<p>{message}</p>}{lines.map((line,n)=><p key={n}>{line}</p>)}</details>;
}

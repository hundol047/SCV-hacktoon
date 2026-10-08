'use client';
import {useEffect,useRef,useState} from 'react';
import {Trip} from '../domain/schema';
import type {CloudTrip} from '../server/store';
const fingerprint=(trip:Trip)=>JSON.stringify({...trip,feedback:[],revision:0});
export default function FamilySync({trip,onTrip,initialCloud,accessToken}:{trip:Trip|null;onTrip:(t:Trip)=>void;initialCloud?:CloudTrip;accessToken?:string}){
  const [status,setStatus]=useState<{storage:{connected:boolean;sessionConfigured:boolean}}|null>(null),[cloud,setCloud]=useState<CloudTrip|null>(initialCloud??null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[link,setLink]=useState(''),[list,setList]=useState<{id:string;title:string}[]>([]),[conflict,setConflict]=useState(false);
  const saved=useRef(initialCloud?fingerprint(initialCloud.trip):''),latest=useRef(trip);latest.current=trip;
  const headers=accessToken?{Authorization:`Bearer ${accessToken}`} as Record<string,string>:{};
  async function api(path:string,method='GET',body?:unknown){const r=await fetch(path,{method,headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined,cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error??'서버 요청에 실패했습니다.');return data;}
  async function session(){await api('/api/session','POST');}
  useEffect(()=>{const controller=new AbortController();fetch('/api/status',{signal:controller.signal}).then(r=>r.json()).then(setStatus).catch(()=>{});return ()=>controller.abort();},[]);
  useEffect(()=>{if(cloud&&trip&&cloud.trip.id!==trip.id){setCloud(null);setLink('');setConflict(false);}},[trip?.id]);
  useEffect(()=>{if(!cloud)return;let active=true;const controller=new AbortController();
    const poll=async()=>{try{const r=await fetch(`/api/trips/${cloud.id}`,{headers,cache:'no-store',signal:controller.signal});if(!r.ok)return;const remote:CloudTrip=await r.json();if(!active||remote.storageVersion===cloud.storageVersion)return;
      const local=latest.current;if(local&&fingerprint(local)!==saved.current){setConflict(true);setMessage('다른 기기에서 변경되었어요. 로컬 수정안을 보존했습니다. 최신 일정을 읽은 뒤 다시 저장해 주세요.');onTrip({...local,feedback:[...new Map([...local.feedback,...remote.trip.feedback].map(f=>[f.id,f])).values()].slice(-30)});return;}
      saved.current=fingerprint(remote.trip);setCloud(remote);onTrip(remote.trip);setMessage('다른 기기의 최신 일정·의견을 반영했습니다.');
    }catch{}};const timer=setInterval(poll,5000);return ()=>{active=false;controller.abort();clearInterval(timer);};
  },[cloud?.id,cloud?.storageVersion]);
  async function action(fn:()=>Promise<void>){setBusy(true);setMessage('');try{await fn();}catch(e){setMessage(e instanceof Error?e.message:'연결을 확인해 주세요.');}finally{setBusy(false);}}
  const available=status?.storage.connected&&status.storage.sessionConfigured;
  if(!available)return <section className="cloud-panel no-print"><h2>서버 보관·가족 확인</h2><p>서버 저장소가 연결되면 여러 기기에서 일정과 의견을 확인할 수 있어요. 현재는 로컬 보관함·JSON 내보내기를 사용할 수 있습니다.</p></section>;
  return <section className="cloud-panel no-print"><h2>서버 보관·가족 확인</h2><p>서버 여행은 마지막 저장 후 30일간 보관합니다. 공유 링크는 7일간 유효하며, 링크를 가진 사람이 접근할 수 있습니다. 부모님 확인 링크는 의견만 남길 수 있고, 편집 링크는 일정 수정도 허용합니다.</p>
    <div className="schedule-actions"><button className="secondary" disabled={busy} onClick={()=>action(async()=>{await session();const result=await api('/api/trips');setList(result.trips);setMessage(result.trips.length?'서버 보관함을 불러왔어요.':'서버에 저장된 여행이 없어요.');})}>서버 보관함 열기</button>
      {trip&&<button className="secondary" disabled={busy||conflict} onClick={()=>action(async()=>{if(!accessToken)await session();const result:CloudTrip=cloud?await api(`/api/trips/${cloud.id}`,'PUT',{trip,storageVersion:cloud.storageVersion}):await api('/api/trips','POST',trip);saved.current=fingerprint(result.trip);setCloud(result);onTrip(result.trip);setMessage('서버에 저장했습니다.');})}>{cloud?'서버 변경 저장':'서버에 새 여행 저장'}</button>}
      {cloud&&<button className="secondary" disabled={busy} onClick={()=>action(async()=>{const result:CloudTrip=await api(`/api/trips/${cloud.id}`);saved.current=fingerprint(result.trip);setCloud(result);onTrip(result.trip);setConflict(false);setMessage('최신 서버 일정을 불러왔어요.');})}>최신 서버 일정 불러오기</button>}
    </div>
    {list.map(t=><button className="library-row" key={t.id} onClick={()=>action(async()=>{const result:CloudTrip=await api(`/api/trips/${t.id}`);saved.current=fingerprint(result.trip);setCloud(result);onTrip(result.trip);setConflict(false);})}>{t.title}</button>)}
    {cloud?.role==='owner'&&<><div className="schedule-actions">{(['viewer','editor'] as const).map(role=><button className="secondary" key={role} disabled={busy} onClick={()=>action(async()=>{const result=await api(`/api/trips/${cloud.id}`,'POST',{action:'invite',role});setLink(`${location.origin}/family#${result.fragment}`);setMessage('공유 링크를 만들었어요. 공개 게시하지 마세요.');})}>{role==='viewer'?'부모님 확인 링크 만들기':'가족 편집 링크 만들기'}</button>)}<button className="text-button" disabled={busy} onClick={()=>action(async()=>{await api(`/api/trips/${cloud.id}`,'POST',{action:'revoke'});setLink('');setMessage('이 여행의 모든 공유 링크를 폐기했습니다.');})}>공유 링크 모두 폐기</button></div>{link&&<label>가족에게 전달할 비공개 링크<input value={link} readOnly onFocus={e=>e.target.select()}/><button className="secondary" onClick={()=>action(async()=>{await navigator.clipboard.writeText(link);setMessage('링크를 복사했습니다.');})}>링크 복사</button></label>}</>}
    {message&&<p role="status">{message}</p>}
    <details><summary>서버 여행 삭제</summary><p>삭제하면 해당 여행의 공유 링크도 폐기됩니다. 브라우저 기록 삭제와 서버 삭제는 별개입니다. 브라우저 쿠키를 지우면 소유자 접근 권한이 사라질 수 있으니 JSON 백업과 편집 링크를 보관하세요.</p><button className="text-button" disabled={busy} onClick={()=>action(async()=>{if(!confirm('이 세션이 소유한 서버 여행을 모두 삭제할까요?'))return;await session();await api('/api/trips','DELETE');setCloud(null);setList([]);setLink('');setMessage('소유한 서버 여행을 삭제했습니다. 로컬 기록은 유지됩니다.');})}>소유한 서버 여행 모두 삭제</button></details>
  </section>;
}

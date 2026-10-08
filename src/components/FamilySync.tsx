'use client';
import {useEffect,useRef,useState} from 'react';
import {Trip} from '../domain/schema';
import {cloudSchema,type CloudTrip} from '../server/store';
const fingerprint=(trip:Trip)=>JSON.stringify({...trip,feedback:[],revision:0});
const metadataKey='bopok:cloud:v1';
type Metadata={id:string;storageVersion:number;tripId:string;saved:string};
class APIError extends Error {constructor(message:string,public status:number){super(message);}}
export default function FamilySync({trip,onTrip,onOpen,initialCloud,accessToken,hidden=false}:{trip:Trip|null;onTrip:(t:Trip)=>void;onOpen?:()=>void;initialCloud?:CloudTrip;accessToken?:string;hidden?:boolean}){
 const [status,setStatus]=useState<{storage:{connected:boolean;ready?:boolean;sessionConfigured:boolean}}|null>(null),[cloud,setCloud]=useState<CloudTrip|null>(initialCloud??null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[restoring,setRestoring]=useState(false),[link,setLink]=useState(''),[list,setList]=useState<{id:string;title:string}[]>([]),[conflict,setConflict]=useState(false),[recoveryKey,setRecoveryKey]=useState(''),[recoveryInput,setRecoveryInput]=useState('');
 const saved=useRef(initialCloud?fingerprint(initialCloud.trip):''),latest=useRef(trip),onChange=useRef(onTrip),connections=useRef(new Map<string,Metadata>());latest.current=trip;onChange.current=onTrip;
 const available=status?.storage.ready===true&&status.storage.sessionConfigured;
 async function api(path:string,method='GET',body?:unknown){const r=await fetch(path,{method,headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const data=await r.json();if(!r.ok)throw new APIError(data.error??'서버 요청에 실패했습니다.',r.status);return data;}
 async function session(){await api('/api/session','POST');}
 function remember(value:CloudTrip){
  if(value.role!=='owner'||accessToken)return;
  connections.current.set(value.trip.id,{id:value.id,storageVersion:value.storageVersion,tripId:value.trip.id,saved:saved.current});
  const entries=[...connections.current.values()].slice(-20);try{localStorage.setItem(metadataKey,JSON.stringify(entries));}catch{setMessage('서버 연결 정보의 브라우저 보관에 실패했습니다. 서버 보관함에서 다시 열어 주세요.');}
 }
 function accept(value:CloudTrip,open=false){saved.current=fingerprint(value.trip);setCloud(value);remember(value);onChange.current(value.trip);setConflict(false);if(open)onOpen?.();}
 function unauthorized(e:unknown){if(e instanceof APIError&&[401,403,404].includes(e.status)){setCloud(null);setLink('');setConflict(false);if(latest.current)connections.current.delete(latest.current.id);try{localStorage.setItem(metadataKey,JSON.stringify([...connections.current.values()]));}catch{}}}
 useEffect(()=>{const controller=new AbortController();fetch('/api/status',{signal:controller.signal}).then(r=>r.json()).then(setStatus).catch(()=>{});try{const entries=JSON.parse(localStorage.getItem(metadataKey)??'[]');if(Array.isArray(entries))for(const v of entries.slice(-20))if(typeof v.id==='string'&&typeof v.tripId==='string'&&typeof v.saved==='string'&&Number.isInteger(v.storageVersion))connections.current.set(v.tripId,v);}catch{}return ()=>controller.abort();},[]);
 useEffect(()=>{if(!available||accessToken)return;api('/api/session','POST',{action:'refresh'}).catch(e=>setMessage(e.message));const timer=setInterval(()=>api('/api/session','POST',{action:'refresh'}).catch(e=>setMessage(e.message)),10*60000);return ()=>clearInterval(timer);},[available,accessToken]);
 useEffect(()=>{
  if(!available)return;let active=true;setLink('');setConflict(false);
  if(!trip){setCloud(null);try{if(!initialCloud&&!localStorage.getItem(metadataKey))connections.current.clear();}catch{}return;}
  if(cloud?.trip.id===trip.id)return;
  const metadata=connections.current.get(trip.id);setCloud(null);saved.current='';
  if(initialCloud?.trip.id===trip.id){saved.current=fingerprint(initialCloud.trip);setCloud(initialCloud);return;}
  if(!metadata||accessToken)return;
  setRestoring(true);api(`/api/trips/${metadata.id}`).then(data=>{if(!active)return;const remote=cloudSchema.parse(data);if(remote.trip.id!==trip.id)throw Error('서버 여행 연결이 일치하지 않습니다.');
   saved.current=metadata.saved;const local=latest.current!;
   if(fingerprint(local)!==metadata.saved){setCloud(remote);if(fingerprint(remote.trip)!==metadata.saved){setConflict(true);setMessage('로컬 수정과 다른 기기의 변경이 함께 있습니다. 최신 서버 일정을 확인해 주세요.');}else{remember(remote);onChange.current({...local,feedback:remote.trip.feedback});}}
   else accept(remote);
  }).catch(e=>{if(active){unauthorized(e);setMessage(e.message);}}).finally(()=>{if(active)setRestoring(false);});return ()=>{active=false;setRestoring(false);};
 },[trip?.id,available]);
 useEffect(()=>{if(!cloud)return;let active=true;const controller=new AbortController();let pending=false;
  const poll=async()=>{if(pending)return;pending=true;try{if(!accessToken)await api('/api/session','POST',{action:'refresh'});const r=await fetch(`/api/trips/${cloud.id}`,{headers:accessToken?{Authorization:`Bearer ${accessToken}`}:{},cache:'no-store',signal:controller.signal});const data=await r.json();if(!r.ok)throw new APIError(data.error,r.status);const remote=cloudSchema.parse(data);if(!active||remote.storageVersion===cloud.storageVersion||latest.current?.id!==remote.trip.id)return;
   const local=latest.current;if(local&&fingerprint(local)!==saved.current){
    if(fingerprint(remote.trip)!==saved.current){setConflict(true);setMessage('다른 기기에서 변경되었어요. 로컬 수정안을 보존했습니다. 최신 일정을 읽은 뒤 다시 저장해 주세요.');}
    setCloud(remote);remember(remote);
    onChange.current({...local,feedback:[...new Map([...local.feedback,...remote.trip.feedback].map(f=>[f.id,f])).values()].sort((a,b)=>a.at.localeCompare(b.at)).slice(-30)});return;
   }
   accept(remote);setMessage('다른 기기의 최신 일정·의견을 반영했습니다.');
  }catch(e){if(active){unauthorized(e);if(e instanceof APIError)setMessage(e.message);}}finally{pending=false;}};const timer=setInterval(poll,5000);return ()=>{active=false;controller.abort();clearInterval(timer);};
 },[cloud?.id,cloud?.storageVersion,accessToken]);
 async function action(fn:()=>Promise<void>){setBusy(true);setMessage('');try{await fn();}catch(e){unauthorized(e);setMessage(e instanceof Error?e.message:'연결을 확인해 주세요.');}finally{setBusy(false);}}
 if(!available)return <section hidden={hidden} className="cloud-panel no-print"><h2>서버 보관·가족 확인</h2><p>서버 저장소·세션과 최신 DB 설정이 준비되면 여러 기기에서 일정과 의견을 확인할 수 있어요. 현재는 로컬 보관함·JSON 내보내기를 사용할 수 있습니다.</p></section>;
 return <section hidden={hidden} className="cloud-panel no-print"><h2>서버 보관·가족 확인</h2><p>서버 여행은 마지막 저장 후 30일간 보관합니다. 공유 링크는 7일간 유효하며, 링크를 가진 사람이 접근할 수 있습니다. 부모님 확인 링크는 의견만 남길 수 있고, 편집 링크는 일정 수정도 허용합니다.</p>
 <div className="schedule-actions"><button className="secondary" disabled={busy||restoring} onClick={()=>action(async()=>{await session();const result=await api('/api/trips');setList(result.trips);setMessage(result.trips.length?'서버 보관함을 불러왔어요.':'서버에 저장된 여행이 없어요.');})}>서버 보관함 열기</button>
 {trip&&<button className="secondary" disabled={busy||restoring||conflict||cloud?.role==='viewer'} onClick={()=>action(async()=>{if(!accessToken)await session();const submitted=trip;let result=cloudSchema.parse(cloud?await api(`/api/trips/${cloud.id}`,'PUT',{trip:submitted,storageVersion:cloud.storageVersion}):await api('/api/trips','POST',submitted));
  if(!cloud&&fingerprint(result.trip)!==fingerprint(submitted)){setCloud(result);saved.current=fingerprint(result.trip);remember(result);setConflict(true);setMessage('같은 여행이 서버에 있습니다. 최신 서버 일정을 불러온 뒤 변경해 주세요.');return;}
  saved.current=fingerprint(result.trip);remember(result);if(latest.current?.id!==submitted.id)return;setCloud(result);
  if(fingerprint(latest.current)===fingerprint(submitted))onChange.current(result.trip);else onChange.current({...latest.current,feedback:result.trip.feedback});setMessage('서버에 저장했습니다.');})}>{restoring?'서버 연결 복원 중…':cloud?'서버 변경 저장':'서버에 새 여행 저장'}</button>}
 {cloud&&<button className="secondary" disabled={busy} onClick={()=>action(async()=>{accept(cloudSchema.parse(await api(`/api/trips/${cloud.id}`)));setMessage('최신 서버 일정을 불러왔어요.');})}>최신 서버 일정 불러오기</button>}</div>
 {list.map(t=><button className="library-row" key={t.id} onClick={()=>action(async()=>{accept(cloudSchema.parse(await api(`/api/trips/${t.id}`)),true);})}>{t.title}</button>)}
 {cloud?.role==='owner'&&<><div className="schedule-actions">{(['viewer','editor'] as const).map(role=><button className="secondary" key={role} disabled={busy} onClick={()=>action(async()=>{await session();const result=await api(`/api/trips/${cloud.id}`,'POST',{action:'invite',role});setLink(`${location.origin}/family#${result.fragment}`);setMessage('공유 링크를 만들었어요. 공개 게시하지 마세요.');})}>{role==='viewer'?'부모님 확인 링크 만들기':'가족 편집 링크 만들기'}</button>)}<button className="text-button" disabled={busy} onClick={()=>action(async()=>{await session();await api(`/api/trips/${cloud.id}`,'POST',{action:'revoke'});setLink('');setMessage('이 여행의 모든 공유 링크를 폐기했습니다.');})}>공유 링크 모두 폐기</button></div>{link&&<label>가족에게 전달할 비공개 링크<input value={link} readOnly onFocus={e=>e.target.select()}/><button className="secondary" onClick={()=>action(async()=>{await navigator.clipboard.writeText(link);setMessage('링크를 복사했습니다.');})}>링크 복사</button></label>}</>}
 {message&&<p role="status">{message}</p>}
 {!accessToken&&<details><summary>서버 소유권 복구</summary><p>활동 중 세션은 같은 소유자로 갱신됩니다. 쿠키 삭제·만료에 대비해 복구 키를 미리 발급하고 안전한 곳에 보관하세요. 키를 가진 사람은 모든 서버 여행의 소유자 권한을 얻습니다. 재발급하면 이전 키가 폐기되며, 마지막 세션 갱신 후 1년간 유효합니다.</p><button className="secondary" disabled={busy} onClick={()=>action(async()=>{await session();const result=await api('/api/session','POST',{action:'recovery-key'});setRecoveryKey(result.key);setMessage('복구 키를 발급했습니다. 키는 브라우저에 자동 저장하지 않습니다.');})}>복구 키 발급 / 재발급</button>{recoveryKey&&<label>새 복구 키<input aria-label="새 복구 키" readOnly value={recoveryKey} onFocus={e=>e.target.select()}/><button className="secondary" onClick={()=>action(async()=>{await navigator.clipboard.writeText(recoveryKey);setMessage('복구 키를 복사했습니다.');})}>복구 키 복사</button></label>}<label>보관한 복구 키<input autoComplete="off" type="password" value={recoveryInput} onChange={e=>setRecoveryInput(e.target.value)}/></label><button className="secondary" disabled={busy||!recoveryInput} onClick={()=>action(async()=>{await api('/api/session','POST',{action:'recover',key:recoveryInput.trim()});setRecoveryInput('');setRecoveryKey('');setCloud(null);connections.current.clear();try{localStorage.removeItem(metadataKey);}catch{}const result=await api('/api/trips');setList(result.trips);setMessage('소유권을 복구했습니다. 서버 보관함에서 여행을 선택해 주세요.');})}>소유권 복구하기</button></details>}
 {!accessToken&&<details><summary>서버 여행 삭제</summary><p>삭제하면 해당 여행의 공유 링크도 폐기됩니다. 브라우저 기록 삭제와 서버 삭제는 별개입니다.</p><button className="text-button" disabled={busy} onClick={()=>action(async()=>{if(!confirm('이 세션이 소유한 서버 여행을 모두 삭제할까요?'))return;await session();await api('/api/trips','DELETE');setCloud(null);connections.current.clear();try{localStorage.removeItem(metadataKey);}catch{}setList([]);setLink('');setMessage('소유한 서버 여행을 삭제했습니다. 로컬 기록은 유지됩니다.');})}>소유한 서버 여행 모두 삭제</button></details>}
 </section>;
}

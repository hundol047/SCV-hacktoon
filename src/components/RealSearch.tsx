'use client';
import {useState} from 'react';
import {Catalog,catalogSchema} from '../data/catalog';
export default function RealSearch({onLoaded}:{onLoaded:(c:Catalog)=>void}){const [region,setRegion]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function search(){if(!region.trim()){setMessage('도시와 국가를 입력해 주세요.');return;}setBusy(true);setMessage('');try{const res=await fetch('/api/catalog?region='+encodeURIComponent(region.trim()),{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error);const c=catalogSchema.parse(data);onLoaded(c);setMessage(`${c.places.length}개 실제 장소를 조회했습니다. 미확인 정보는 충족으로 판정하지 않습니다.`);}catch(e){setMessage(e instanceof Error?e.message:'검색에 실패했습니다.');}finally{setBusy(false);}}
  return <section className="real-search"><h2>전국·해외 도시의 실제 장소 검색</h2><label>도시와 국가<input maxLength={120} value={region} onChange={e=>setRegion(e.target.value)} placeholder="대한민국 강릉 / 일본 교토 / 프랑스 파리"/></label><button className="secondary" onClick={search} disabled={busy}>{busy?'실제 장소 조회 중…':'실제 장소 조회'}</button><p role="status">{message}</p><p className="helper">한 여행은 한 도시·1~2일을 대상으로 합니다. 도시 중심 반경 10km의 OpenStreetMap 자료를 조회합니다. 모든 도시의 시설 정보가 갖춰져 있음을 보장하지 않습니다. 내부 보행·계단·식사·좌석 정보는 미확인일 수 있습니다.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap 기여자 · ODbL</a></section>;
}

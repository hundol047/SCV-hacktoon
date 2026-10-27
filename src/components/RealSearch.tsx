'use client';
import {useState} from 'react';
import {Catalog,catalogSchema} from '../data/catalog';
import KoreaTourism from './KoreaTourism';
export default function RealSearch({onLoaded,adding=false}:{adding?:boolean;onLoaded:(c:Catalog)=>void}){
  const [region,setRegion]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[limit,setLimit]=useState(30),[radius,setRadius]=useState(10);
  const mobile=typeof window!=='undefined'&&!!window.BopokAndroid;
  async function search(){
    if(!region.trim()){setMessage('도시와 국가를 입력해 주세요.');return;}
    setBusy(true);setMessage('');
    try{const res=await fetch('/api/catalog?region='+encodeURIComponent(region.trim())+'&limit='+limit+'&radius='+radius,{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error);const c=catalogSchema.parse(data);onLoaded(c);setMessage(`${c.places.length}개 실제 장소를 조회했습니다. 미확인 정보는 충족으로 판정하지 않습니다.`);}catch(e){setMessage(e instanceof Error?e.message:'검색에 실패했습니다.');}finally{setBusy(false);}
  }
  return <section className="real-search">
    <h2>{adding?'다음 도시 추가':'어디로 떠날까요?'}</h2>
    <p>국내 여행은 전국 자료에서 시·도와 동네를 고른 뒤 ‘이 지역 후보를 일정에 사용’을 누르세요.</p>
    <KoreaTourism onLoaded={onLoaded}/>
    {mobile?<p className="helper">해외 도시·실시간 검색은 서버 연결 후 이용할 수 있습니다. 현재는 위의 국내 수집 자료를 사용하세요.</p>:<>
      <h3>온라인 도시 검색</h3>
      <label>{adding?'추가 도시와 국가':'도시와 국가'}<input maxLength={120} value={region} onChange={e=>setRegion(e.target.value)} placeholder="대한민국 강릉 / 일본 교토 / 프랑스 파리"/></label>
      <details className="advanced-settings"><summary>검색 반경·후보 수 조정</summary>
        <label>도시 중심 검색 반경 (km)<input type="number" min={1} max={50} value={radius} onChange={e=>setRadius(Number(e.target.value))}/></label>
        <label>도시 후보 수<input type="number" min={10} max={200} value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label>
      </details>
      <button className="secondary" onClick={search} disabled={busy}>{busy?'실제 장소 조회 중…':adding?'도시 추가 조회':'실제 장소 조회'}</button>
      <p className="helper">OpenStreetMap의 도시 반경 후보입니다. 시설·보행·메뉴의 미확인 항목은 출발 전 확인하세요.</p>
    </>}
    {message&&<p role="status">{message}</p>}
  </section>;
}

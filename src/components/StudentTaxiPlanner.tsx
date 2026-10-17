"use client";
import { useMemo, useState } from 'react';
import type { Basics } from '../domain/schema';
import { optimizeTaxiOrder, taxiPlanSummary } from '../domain/taxi-plan';
import type { Catalog } from '../data/catalog';

type Props = { basics: Basics; catalog: Catalog; onChange: (basics: Basics) => void };

export default function StudentTaxiPlanner({ basics, catalog, onChange }: Props) {
  return <Planner key={catalog.places.map(p=>p.id).join('|')} basics={basics} catalog={catalog} onChange={onChange}/>;
}
function Planner({ basics, catalog, onChange }: Props) {
  const candidates = useMemo(() => catalog.places.filter(place => place.latitude !== undefined && place.longitude !== undefined && ['visit', 'meal', 'rest'].includes(place.kind)), [catalog]);
  const saved = basics.taxiPlan;
  const [selected, setSelected] = useState<string[]>(() => (saved?.selectedPlaceIds ?? []).filter(id => candidates.some(place => place.id === id)));
  const [start, setStart] = useState(saved?.startPlaceId ?? '');
  const [end, setEnd] = useState(saved?.endPlaceId ?? '');
  const [returning, setReturning] = useState(saved?.returnToStart ?? false);
  const [day, setDay] = useState(saved?.day ?? 1);
  const [capacity, setCapacity] = useState(String(saved?.taxiCapacity ?? 4));
  const [limit, setLimit] = useState(60);
  const [travelers, setTravelers] = useState(String(saved?.travelers ?? 1));
  const [baseFare, setBaseFare] = useState(saved?.baseFare === null || saved?.baseFare === undefined ? '' : String(saved.baseFare));
  const [perKmFare, setPerKmFare] = useState(saved?.perKmFare === null || saved?.perKmFare === undefined ? '' : String(saved.perKmFare));
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const edit = () => { if(saved) onChange({...basics,taxiPlan:undefined}); setMessage('입력이 바뀌었습니다. 순서를 다시 계산해 주세요.'); };
  const region = basics.destinations?.find(d=>d.startDay<=day&&d.endDay>=day)?.region;
  const filtered = candidates.filter(p=>(!region||(p.region??catalog.region)===region)&&(!query.trim()||p.name.toLowerCase().includes(query.trim().toLowerCase())));
  const shown = filtered.slice(0,limit);
  const toggle = (id: string) => {
    if(!selected.includes(id)&&selected.length>=20){setMessage('장소는 최대 20곳까지 선택할 수 있습니다.');return;}
    edit();setSelected(selected.includes(id)?selected.filter(v=>v!==id):[...selected,id]);
    if(start===id)setStart('');if(end===id)setEnd('');
  };
  const calculate = () => {
    if(day>basics.days){setMessage('여행 기간 안의 여행일을 선택해 주세요.');return;}
    const result = optimizeTaxiOrder(candidates, selected, start || selected[0] || '', Number(travelers), baseFare === '' ? null : Number(baseFare), perKmFare === '' ? null : Number(perKmFare),new Date().toISOString(),{day,taxiCapacity:Number(capacity),endPlaceId:end||undefined,returnToStart:returning});
    if ('error' in result) { setMessage(result.error); return; }
    onChange({ ...basics, taxiPlan: result.plan });
    setStart(result.plan.startPlaceId);
    setMessage(`${day}일차 순서를 저장했습니다. 다른 날짜의 일정은 유지합니다.`);
  };
  return <details className="cloud-panel taxi-planner">
    <summary>차 없는 대학생 · 택시 절약 여행</summary>
    <div className="panel-body">
      <p className="helper">가고 싶은 장소를 2~20곳 고르면 좌표 직선거리 기준으로 순서를 정합니다. 실제 도로 거리와 택시요금은 경로 조회 전까지 확정하지 않습니다.</p>
      <label>장소 검색<input value={query} onChange={event => setQuery(event.target.value)} placeholder="장소 이름" /></label>
      <label>택시 여행일<select value={day} onChange={e=>{edit();setDay(Number(e.target.value));setSelected([]);setStart('');setEnd('');}}>{Array.from({length:basics.days},(_,i)=><option key={i+1} value={i+1}>{i+1}일차</option>)}</select></label>
      <p>선택 {selected.length}/20곳 · 검색 결과 {filtered.length}곳</p>
      <div className="candidate-list" role="group" aria-label="택시 방문 장소 선택">
        {shown.map(place => <label key={place.id} className="check-row"><input type="checkbox" checked={selected.includes(place.id)} onChange={() => toggle(place.id)} />{place.name}<small>{place.kind === 'meal' ? '식사' : place.kind === 'rest' ? '휴식' : '관광'} · 좌표 확인</small></label>)}
        {!shown.length && <p className="helper">좌표가 확인된 장소가 없습니다. 실제 장소를 먼저 불러와 주세요.</p>}
      </div>
      {filtered.length>limit&&<button type="button" className="secondary" onClick={()=>setLimit(limit+60)}>장소 더 보기</button>}
      <div className="field-grid">
        <label>출발 장소<select value={start} onChange={event => {edit();setStart(event.target.value);if(event.target.value===end)setEnd('');}}><option value="">첫 선택 장소</option>{selected.map(id => <option key={id} value={id}>{candidates.find(place => place.id === id)?.name ?? id}</option>)}</select></label>
        <label>마지막 도착 장소<select value={end} disabled={returning} onChange={e=>{edit();setEnd(e.target.value);}}><option value="">자동 결정</option>{selected.filter(id=>id!==(start||selected[0])).map(id=><option key={id} value={id}>{candidates.find(p=>p.id===id)?.name??id}</option>)}</select></label>
        <label>여행 인원<input type="number" min={1} max={20} value={travelers} onChange={event => {edit();setTravelers(event.target.value);}} /></label>
        <label>차량당 탑승 인원<input type="number" min={1} max={8} value={capacity} onChange={e=>{edit();setCapacity(e.target.value);}}/><small>기사 제외 정원입니다. 차량 종류·짐을 고려해 입력하세요.</small></label>
        <label>기본요금 가정(원)<input type="number" min={0} max={100000} value={baseFare} onChange={event => {edit();setBaseFare(event.target.value);}} placeholder="선택" /></label>
        <label>km당 요금 가정(원)<input type="number" min={0} max={100000} value={perKmFare} onChange={event => {edit();setPerKmFare(event.target.value);}} placeholder="선택" /></label>
      </div>
      <label className="check-row"><input type="checkbox" checked={returning} onChange={e=>{edit();setReturning(e.target.checked);setEnd('');}}/>마지막에 출발지로 복귀</label>
      <p>각 구간에서 새로 탑승한다고 가정해 기본요금을 더합니다. 원화 단순 계산이며 기본거리 공제·시간요금·야간 할증·통행료는 반영하지 않습니다. 실제 견적이나 최저요금을 보장하지 않습니다.</p>
      <button type="button" className="primary" onClick={calculate}>택시 이동 순서 계산</button>
      <button type="button" className="secondary" onClick={()=>{setSelected([]);setStart('');setEnd('');onChange({...basics,taxiPlan:undefined});setMessage('택시 순서를 해제했습니다. 일반 일정 생성으로 돌아갑니다.');}}>택시 순서 해제</button>
      {saved && <div className="notice"><strong>{taxiPlanSummary(saved)}</strong><p>택시 {saved.vehicles}대 · {saved.day??1}일차</p><ol>{saved.orderedPlaceIds.map(id => <li key={id}>{candidates.find(place => place.id === id)?.name ?? id}</li>)}{saved.returnToStart&&<li>출발지로 복귀</li>}</ol></div>}
      {message && <p className="helper" role="status">{message}</p>}
    </div>
  </details>;
}

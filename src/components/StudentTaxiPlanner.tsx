"use client";
import { useMemo, useState } from 'react';
import { defaultConditions, type Conditions, type Basics } from '../domain/schema';
import { haversineKm, optimizeTaxiOrder, taxiPlanSummary } from '../domain/taxi-plan';
import type { Catalog } from '../data/catalog';

import {rankVehiclePlaces} from '../domain/vehicle-recommendations';

type Props = { conditions?: Conditions; basics: Basics; catalog: Catalog; onChange: (basics: Basics) => void };

export default function StudentTaxiPlanner({ basics, catalog, onChange, conditions=defaultConditions }: Props) {
  return <Planner conditions={conditions} key={basics.transport+catalog.places.map(p=>p.id).join('|')} basics={basics} catalog={catalog} onChange={onChange}/>;
}
function Planner({ basics, catalog, onChange, conditions=defaultConditions }: Props) {
  const candidates = useMemo(() => catalog.places.filter(place => place.latitude !== undefined && place.longitude !== undefined && ['visit', 'meal', 'rest'].includes(place.kind)), [catalog]);
  const driving=basics.transport==='driving',vehicle=driving?'자가용':'택시';
  const saved = basics.taxiPlan;
  const [costs,setCosts]=useState({kmPerLiter:saved?.drivingCosts?.kmPerLiter?.toString()??'',fuelPrice:saved?.drivingCosts?.fuelPrice?.toString()??'',parking:saved?.drivingCosts?.parking?.toString()??'',tolls:saved?.drivingCosts?.tolls?.toString()??''});
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
  const [kind,setKind] = useState('all');
  const [onlySelected,setOnlySelected] = useState(false);
  const [message, setMessage] = useState('');
  const edit = () => { if(saved) onChange({...basics,taxiPlan:undefined}); setMessage('입력이 바뀌었습니다. 순서를 다시 계산해 주세요.'); };
  const region = basics.destinations?.find(d=>d.startDay<=day&&d.endDay>=day)?.region;
  const filtered = candidates.filter(p=>(!region||(p.region??catalog.region)===region)&&(kind==='all'||p.kind===kind)&&(!onlySelected||selected.includes(p.id))&&(!query.trim()||(p.name+' '+p.description).toLowerCase().includes(query.trim().toLowerCase())));
  const recommendations=rankVehiclePlaces(candidates.filter(p=>p.kind==='visit'&&!selected.includes(p.id)&&(!region||(p.region??catalog.region)===region)),basics,conditions,candidates.find(p=>p.id===(start||selected[0]))).slice(0,5);
  const shown = filtered.slice(0,limit);
  const toggle = (id: string) => {
    if(!selected.includes(id)&&selected.length>=20){setMessage('장소는 최대 20곳까지 선택할 수 있습니다.');return;}
    edit();setSelected(selected.includes(id)?selected.filter(v=>v!==id):[...selected,id]);
    if(start===id)setStart('');if(end===id)setEnd('');
  };
  const calculate = () => {
    if(day>basics.days){setMessage('여행 기간 안의 여행일을 선택해 주세요.');return;}
    if(driving&&Object.values(costs).some(v=>v!=='')&&Object.values(costs).some(v=>v==='')){setMessage('차량 비용은 네 항목을 모두 입력하거나 모두 비워 주세요. 없는 비용은 0으로 입력하세요.');return;}
    const result = optimizeTaxiOrder(candidates, selected, start || selected[0] || '', Number(travelers), driving || baseFare === '' ? null : Number(baseFare), driving || perKmFare === '' ? null : Number(perKmFare),new Date().toISOString(),{transport:driving?'driving':'taxi',drivingCosts:driving&&costs.kmPerLiter!==''?{kmPerLiter:Number(costs.kmPerLiter),fuelPrice:Number(costs.fuelPrice),parking:Number(costs.parking),tolls:Number(costs.tolls)}:undefined,day,taxiCapacity:Number(capacity),endPlaceId:end||undefined,returnToStart:returning});
    if ('error' in result) { setMessage(result.error); return; }
    onChange({ ...basics, taxiPlan: result.plan });
    setStart(result.plan.startPlaceId);
    setMessage(`${day}일차 순서를 저장했습니다. 다른 날짜의 일정은 유지합니다.`);
  };
  return <details className="cloud-panel taxi-planner">
    <summary>{driving?'자가용 · 편안한 동행 여행':'차 없는 대학생 · 택시 절약 여행'}</summary>
    <div className="panel-body">
      <p className="helper">가고 싶은 장소를 2~20곳 고르면 좌표 직선거리 기준으로 순서를 정합니다. 실제 도로 거리와 이동 비용은 경로 조회 전까지 확정하지 않습니다.</p>
      <ol className="journey-steps"><li>장소 고르기</li><li>출발지·인원 정하기</li><li>순서 계산하기</li></ol>
      <details><summary>{vehicle} 여행에 맞는 후보 추천</summary><p>선택한 추천 기준과 등록 자료를 이용한 자동 추천입니다. 출발 장소를 고르면 거리도 비교합니다. 주차장·승하차 위치·접근성 미확인 정보는 방문 전에 확인하세요.</p>{recommendations.map(({place,reasons})=><article key={place.id}><strong>{place.name}</strong><p>{reasons.join(' · ')||'비교할 접근성 자료 미확인'}</p><button type="button" disabled={selected.length>=20} onClick={()=>toggle(place.id)}>{place.name} 추가</button></article>)}</details>
      <label>장소 검색<input value={query} onChange={event => setQuery(event.target.value)} placeholder="장소 이름" /></label>
      <div className="place-filters" role="group" aria-label="장소 종류">{[['all','전체'],['visit','관광'],['meal','식사'],['rest','휴식']].map(([value,label])=><button type="button" key={value} aria-pressed={kind===value} onClick={()=>{setKind(value);setLimit(60);}}>{label}</button>)}</div>
      <label className="check-row"><input type="checkbox" checked={onlySelected} onChange={e=>setOnlySelected(e.target.checked)}/>선택한 장소만 보기</label>
      <label>{vehicle} 여행일<select value={day} onChange={e=>{edit();setDay(Number(e.target.value));setSelected([]);setStart('');setEnd('');}}>{Array.from({length:basics.days},(_,i)=><option key={i+1} value={i+1}>{i+1}일차</option>)}</select></label>
      <p>선택 {selected.length}/20곳 · 검색 결과 {filtered.length}곳</p>
      {!!selected.length&&<div className="selected-places" aria-label="선택한 장소">{selected.map(id=><button type="button" key={id} onClick={()=>toggle(id)} aria-label={`${candidates.find(p=>p.id===id)?.name??id} 선택 해제`}>{candidates.find(p=>p.id===id)?.name??id} ×</button>)}</div>}
      <div className="candidate-list" role="group" aria-label={`${vehicle} 방문 장소 선택`}>
        {shown.map(place => <article className="place-choice" key={place.id}><label className="check-row"><input type="checkbox" checked={selected.includes(place.id)} onChange={() => toggle(place.id)} />{place.name}<small>{place.kind === 'meal' ? '식사' : place.kind === 'rest' ? '휴식' : '관광'} · 좌표 확인</small></label><details><summary>{place.name} 상세 정보</summary><p>{place.description}</p><dl><dt>내부 보행</dt><dd>{place.walkMin.value===null?'미확인':`${place.walkMin.value}분`}</dd><dt>앉을 자리</dt><dd>{place.seat.value===null?'미확인':place.seat.value?'있음':'없음'}</dd><dt>계단</dt><dd>{place.stairs.value===null?'미확인':place.stairs.value?'있음':'없음'}</dd></dl>{place.walkMin.source.startsWith('https://')&&<a href={place.walkMin.source} target="_blank" rel="noreferrer">등록 자료 보기</a>}</details></article>)}
        {!shown.length && <p className="helper">일치하는 장소가 없습니다. 검색어를 지우거나 ‘전체’를 선택하세요. 후보가 없다면 지역 자료를 먼저 불러오세요.</p>}
      </div>
      {filtered.length>limit&&<button type="button" className="secondary" onClick={()=>setLimit(limit+60)}>장소 더 보기</button>}
      <div className="field-grid">
        <label>출발 장소<select value={start} onChange={event => {edit();setStart(event.target.value);if(event.target.value===end)setEnd('');}}><option value="">첫 선택 장소</option>{selected.map(id => <option key={id} value={id}>{candidates.find(place => place.id === id)?.name ?? id}</option>)}</select></label>
        <label>마지막 도착 장소<select value={end} disabled={returning} onChange={e=>{edit();setEnd(e.target.value);}}><option value="">자동 결정</option>{selected.filter(id=>id!==(start||selected[0])).map(id=><option key={id} value={id}>{candidates.find(p=>p.id===id)?.name??id}</option>)}</select></label>
        <label>여행 인원<input type="number" min={1} max={20} value={travelers} onChange={event => {edit();setTravelers(event.target.value);}} /></label>
        <label>차량당 탑승 인원<input type="number" min={1} max={8} value={capacity} onChange={e=>{edit();setCapacity(e.target.value);}}/><small>{driving?'여행 인원과 정원에 운전자를 포함하세요. 차량별 운전자가 필요합니다.':'기사 제외 정원입니다. 차량 종류·짐을 고려해 입력하세요.'}</small></label>
      </div>
      <details className="advanced-settings"><summary>선택 사항 · 예상 비용 계산</summary><p>요금을 모르면 비워 두어도 순서를 계산할 수 있습니다.</p><div className="field-grid">
        {driving?<>{([['kmPerLiter','연비(km/L)'],['fuelPrice','유류 단가(원/L)'],['parking','차량 1대당 전체 주차비(원)'],['tolls','차량 1대당 전체 통행료(원)']] as const).map(([key,label])=><label key={key}>{label}<input type="number" min={key==='kmPerLiter'?1:0} step={key==='kmPerLiter'?0.1:1} value={costs[key]} onChange={e=>{edit();setCosts({...costs,[key]:e.target.value});}} placeholder="선택"/></label>)}</>:<>
        <label>기본요금 가정(원)<input type="number" min={0} max={100000} value={baseFare} onChange={event => {edit();setBaseFare(event.target.value);}} placeholder="선택" /></label>
        <label>km당 요금 가정(원)<input type="number" min={0} max={100000} value={perKmFare} onChange={event => {edit();setPerKmFare(event.target.value);}} placeholder="선택" /></label>
        </>}
      </div></details>
      <label className="check-row"><input type="checkbox" checked={returning} onChange={e=>{edit();setReturning(e.target.checked);setEnd('');}}/>마지막에 출발지로 복귀</label>
      <p>{driving?'직선거리 ÷ 연비 × 유류 단가에 주차비·통행료를 더하고 차량 수를 곱합니다. 실제 도로 거리와 연료 소모량은 다르며 보험·대여료는 별도입니다.':'각 구간에서 새로 탑승한다고 가정해 기본요금을 더합니다. 원화 단순 계산이며 기본거리 공제·시간요금·야간 할증·통행료는 반영하지 않습니다. 실제 견적이나 최저요금을 보장하지 않습니다.'}</p>
      <button type="button" className="primary" disabled={selected.length<2} onClick={calculate}>{vehicle} 이동 순서 계산</button>
      {selected.length<2&&<p>순서 계산까지 {2-selected.length}곳을 더 선택하세요.</p>}
      <button type="button" className="secondary" onClick={()=>{setSelected([]);setStart('');setEnd('');onChange({...basics,taxiPlan:undefined});setMessage('차량 순서를 해제했습니다. 일반 일정 생성으로 돌아갑니다.');}}>{vehicle} 순서 해제</button>
      {saved && <div className="notice"><strong>{taxiPlanSummary(saved)}</strong><p>{vehicle} {saved.vehicles}대 · {saved.day??1}일차 · {saved.travelers}명 · {saved.orderedPlaceIds.length}곳</p><ol className="route-preview">{[...saved.orderedPlaceIds,...(saved.returnToStart?[saved.startPlaceId]:[])].map((id,i,ids)=>{const p=candidates.find(p=>p.id===id),prev=candidates.find(p=>p.id===ids[i-1]);const km=p&&prev?haversineKm(prev,p):null;return <li key={`${id}:${i}`}><strong>{p?.name??id}{i===saved.orderedPlaceIds.length?' (복귀)':''}</strong>{km!==null&&<small>이전 장소에서 직선 {km.toFixed(2)}km · 도로 이동 시간 미확인</small>}</li>;})}</ol><p>순서를 저장했습니다. 아래 ‘우리 가족 일정 만들기’를 누르면 시간표에 반영됩니다.</p></div>}
      {message && <p className="helper" role="status">{message}</p>}
    </div>
  </details>;
}

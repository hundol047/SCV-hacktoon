"use client";
import { useEffect, useMemo, useState } from 'react';
import type { Basics } from '../domain/schema';
import { optimizeTaxiOrder, taxiPlanSummary } from '../domain/taxi-plan';
import type { Catalog } from '../data/catalog';

type Props = { basics: Basics; catalog: Catalog; onChange: (basics: Basics) => void };

export default function StudentTaxiPlanner({ basics, catalog, onChange }: Props) {
  const candidates = useMemo(() => catalog.places.filter(place => place.latitude !== undefined && place.longitude !== undefined && ['visit', 'meal', 'rest'].includes(place.kind)), [catalog]);
  const saved = basics.taxiPlan;
  const [selected, setSelected] = useState<string[]>(() => (saved?.selectedPlaceIds ?? []).filter(id => candidates.some(place => place.id === id)));
  const [start, setStart] = useState(saved?.startPlaceId ?? '');
  const [travelers, setTravelers] = useState(String(saved?.travelers ?? 1));
  const [baseFare, setBaseFare] = useState(saved?.baseFare === null || saved?.baseFare === undefined ? '' : String(saved.baseFare));
  const [perKmFare, setPerKmFare] = useState(saved?.perKmFare === null || saved?.perKmFare === undefined ? '' : String(saved.perKmFare));
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    setSelected((basics.taxiPlan?.selectedPlaceIds ?? []).filter(id => candidates.some(place => place.id === id)));
    setStart(basics.taxiPlan?.startPlaceId ?? '');
  }, [catalog, candidates, basics.taxiPlan]);
  const shown = candidates.filter(place => !query.trim() || place.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 60);
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length >= 20 ? current : [...current, id]);
  const calculate = () => {
    const result = optimizeTaxiOrder(candidates, selected, start || selected[0] || '', Number(travelers), baseFare === '' ? null : Number(baseFare), perKmFare === '' ? null : Number(perKmFare));
    if ('error' in result) { setMessage(result.error); return; }
    onChange({ ...basics, taxiPlan: result.plan });
    setStart(result.plan.startPlaceId);
    setMessage('저장했습니다. 일정 생성 시 이 순서로 1일차에 배치합니다.');
  };
  return <details className="cloud-panel">
    <summary>차 없는 대학생 · 택시 절약 여행</summary>
    <div className="panel-body">
      <p className="helper">가고 싶은 장소를 2~20곳 고르면 좌표 직선거리 기준으로 순서를 정합니다. 실제 도로 거리와 택시요금은 경로 조회 전까지 확정하지 않습니다.</p>
      <label>장소 검색<input value={query} onChange={event => setQuery(event.target.value)} placeholder="장소 이름" /></label>
      <div className="candidate-list" role="group" aria-label="택시 방문 장소 선택">
        {shown.map(place => <label key={place.id} className="check-row"><input type="checkbox" checked={selected.includes(place.id)} onChange={() => toggle(place.id)} />{place.name}<small>{place.kind === 'meal' ? '식사' : place.kind === 'rest' ? '휴식' : '관광'} · 좌표 확인</small></label>)}
        {!shown.length && <p className="helper">좌표가 확인된 장소가 없습니다. 실제 장소를 먼저 불러와 주세요.</p>}
      </div>
      <div className="field-grid">
        <label>출발 장소<select value={start} onChange={event => setStart(event.target.value)}><option value="">첫 선택 장소</option>{selected.map(id => <option key={id} value={id}>{candidates.find(place => place.id === id)?.name ?? id}</option>)}</select></label>
        <label>여행 인원<input type="number" min={1} max={20} value={travelers} onChange={event => setTravelers(event.target.value)} /><small>택시 1대당 4명으로 계산</small></label>
        <label>기본요금 가정(원)<input type="number" min={0} max={100000} value={baseFare} onChange={event => setBaseFare(event.target.value)} placeholder="선택" /></label>
        <label>km당 요금 가정(원)<input type="number" min={0} max={100000} value={perKmFare} onChange={event => setPerKmFare(event.target.value)} placeholder="선택" /></label>
      </div>
      <button type="button" className="primary" onClick={calculate}>택시 이동 순서 계산</button>
      {saved && <div className="notice" role="status"><strong>{taxiPlanSummary(saved)}</strong><ol>{saved.orderedPlaceIds.map((id, index) => <li key={id}>{index + 1}. {candidates.find(place => place.id === id)?.name ?? id}</li>)}</ol><small>출발지에서 선택 장소까지의 편도 순서입니다. 귀가 장소를 넣으면 마지막에 배치할 수 있습니다.</small></div>}
      {message && <p className="helper" role="status">{message}</p>}
    </div>
  </details>;
}

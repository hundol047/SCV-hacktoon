'use client';
import {useState} from 'react';
import type {Trip} from '../domain/schema';
import {estimateDefaults,estimateTrip,type EstimateRates} from '../domain/trip-estimate';
const won=(n:number)=>`${n.toLocaleString('ko-KR')}원`;
export default function TripEstimate({trip}:{trip:Trip}){
 const defaults=estimateDefaults(trip);const [overrides,setOverrides]=useState<Partial<EstimateRates>>({});const rates={...defaults,...overrides};const cost=estimateTrip(trip,rates);
 const labels:Record<keyof EstimateRates,string>={meal:'한 끼 / 1인',admission:'입장료 / 1곳·1인',cafe:'카페·간식 / 하루·1인',room:'숙박 / 1박·2인실',local:trip.basics.transport==='taxi'||trip.basics.transport==='driving'?'지역 교통 / 하루·차량 1대':'지역 교통 / 하루·1인',roundTrip:'목적지 왕복 / 1인'};
 return <section className="trip-estimate" aria-label="여행 예상 비용"><div className="estimate-head"><div><span>여행 예상 비용 · {cost.people}명</span><h3>약 {won(cost.total)}</h3></div><strong>1인당 약 {won(cost.perPerson)}</strong></div><p>계획용 예상 금액입니다. 예약 가격에 맞춰 아래 금액을 조정하세요.</p><details><summary>항목별 비용과 계산 기준</summary><ul>{cost.rows.map(r=><li key={r.name}><span>{r.name}<small>{r.basis}</small></span><strong>{won(r.amount)}</strong></li>)}</ul><div className="estimate-rates">{(Object.keys(labels) as (keyof EstimateRates)[]).map(k=><label key={k}>{labels[k]} (원)<input type="number" min="0" max="10000000" step="1000" value={rates[k]} onChange={e=>setOverrides(v=>({...v,[k]:Math.max(0,Math.min(10000000,Number(e.target.value)||0))}))}/></label>)}</div><p>기본 가정: 식사 1.5만원, 입장 1만원, 간식 6천원, 2인실 10만원. 항공·배편 및 장거리 이동은 임시 예산이며 실제 운임이 아닙니다. 자가용 왕복 유류비·통행료, 렌터카·쇼핑 비용은 별도로 더해 주세요. 변경한 금액은 이 화면에서만 반영됩니다.</p><button type="button" className="text-button" onClick={()=>setOverrides({})}>기본 금액으로 되돌리기</button></details></section>;
}

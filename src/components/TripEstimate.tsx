'use client';
import {useState} from 'react';
import type {Trip} from '../domain/schema';
import {estimateDefaults,estimateTrip,type EstimateRates} from '../domain/trip-estimate';
import {benefitSavings} from '../domain/benefit-budget';
import {useKoreaToday} from './useKoreaToday';
const won=(n:number)=>`${n.toLocaleString('ko-KR')}원`;
export default function TripEstimate({trip}:{trip:Trip}){
 const [eligible,setEligible]=useState<Record<string,number>>({});const today=useKoreaToday();
 const defaults=estimateDefaults(trip);const [overrides,setOverrides]=useState<Partial<EstimateRates>>({});const rates={...defaults,...overrides};const cost=estimateTrip(trip,rates);
 const discounts=benefitSavings(trip,rates.admission,eligible,today);const after=Math.max(0,cost.total-discounts.saving);
 const labels:Record<keyof EstimateRates,string>={meal:'한 끼 / 1인',admission:'입장료 / 1곳·1인',cafe:'카페·간식 / 하루·1인',room:'숙박 / 1박·2인실',local:trip.basics.transport==='taxi'||trip.basics.transport==='driving'?'지역 교통 / 하루·차량 1대':'지역 교통 / 하루·1인',roundTrip:'목적지 왕복 / 1인'};
 return <section className="trip-estimate" aria-label="여행 예상 비용"><div className="estimate-head"><div><span>여행 예상 비용 · {cost.people}명</span><h3>약 {won(cost.total)}</h3></div><strong>1인당 약 {won(cost.perPerson)}</strong></div><p>계획용 예상 금액입니다. 예약 가격에 맞춰 아래 금액을 조정하세요.</p>{trip.basics.tripBudget!==undefined&&<p><strong>전체 예산 {won(trip.basics.tripBudget)}</strong> · {after>trip.basics.tripBudget?`약 ${won(after-trip.basics.tripBudget)} 초과`:`약 ${won(trip.basics.tripBudget-after)} 여유`}</p>}
 {discounts.rows.length>0&&<details className="budget-discounts"><summary>할인 조건을 반영한 비용 비교</summary><p>할인 전 약 {won(cost.total)} → 조건 충족 시 약 {won(after)} · 예상 절약 {won(discounts.saving)}</p>{discounts.rows.map((r,index)=><label key={r.id+index}>{r.name}<small>{r.conditions}</small>조건을 충족하는 인원<select value={eligible[r.id]??0} onChange={e=>setEligible(v=>({...v,[r.id]:Number(e.target.value)}))}>{Array.from({length:cost.people+1},(_,n)=><option key={n} value={n}>{n}명</option>)}</select><a href={r.url} target="_blank" rel="noreferrer">조건·정상요금 확인</a></label>)}<p>정상요금이 없는 장소는 입력한 예상 입장료로 계산합니다. 할인 확정 가격이 아니며, 중복 할인은 계산하지 않습니다.</p></details>}
 <details><summary>항목별 비용과 계산 기준</summary><ul>{cost.rows.map(r=><li key={r.name}><span>{r.name}<small>{r.basis}</small></span><strong>{won(r.amount)}</strong></li>)}</ul><div className="estimate-rates">{(Object.keys(labels) as (keyof EstimateRates)[]).map(k=><label key={k}>{labels[k]} (원)<input type="number" min="0" max="10000000" step="1000" value={rates[k]} onChange={e=>setOverrides(v=>({...v,[k]:Math.max(0,Math.min(10000000,Number(e.target.value)||0))}))}/></label>)}</div><p>기본 가정: 식사 1.5만원, 입장 1만원, 간식 6천원, 2인실 10만원. 항공·배편 및 장거리 이동은 임시 예산이며 실제 운임이 아닙니다. 자가용 왕복 유류비·통행료, 렌터카·쇼핑 비용은 별도로 더해 주세요. 변경한 금액은 이 화면에서만 반영됩니다.</p><button type="button" className="text-button" onClick={()=>setOverrides({})}>기본 금액으로 되돌리기</button></details></section>;
}

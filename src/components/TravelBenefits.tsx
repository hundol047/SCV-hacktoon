'use client';
import {useEffect,useState} from 'react';
import type {Trip} from '../domain/schema';
import {dayDate} from '../domain/schema';
import {benefitsReviewedAt} from '../data/travel-benefits';
import {benefitRegionAliases,selectBenefits} from '../domain/travel-benefits';
import {useKoreaToday} from './useKoreaToday';
const kinds={discount:'조건부 할인',resident:'무료 주민증 발급',pass:'유료 관광패스',directory:'공식 혜택 목록'};
export default function TravelBenefits({trip,day}:{trip:Trip;day:number}){
 const [region,setRegion]=useState(''),[expanded,setExpanded]=useState(false);const today=useKoreaToday();

 useEffect(()=>{setRegion('');setExpanded(false);},[trip.id,trip.revision,day]);
 const all=today?selectBenefits(trip,day,region,today):[];const shown=expanded?all:all.slice(0,3);
 return <section className="travel-benefits" aria-label="지역 할인·쿠폰"><details className="benefit-panel"><summary>지역 할인·쿠폰 보기{all.length?` · ${all.length}개`:""}</summary><div className="benefit-heading"><div><h3>여행 혜택 챙기기</h3><p>{dayDate(trip.basics,day)} 방문 기준 · 발급·구매는 제공처에서</p></div><label>혜택 지역<select value={region} onChange={e=>{setRegion(e.target.value);setExpanded(false);}}><option value="">내 일정 지역</option>{Object.keys(benefitRegionAliases).map(r=><option key={r} value={r}>{r}</option>)}</select></label></div>
 <div className="benefit-list">{shown.map(b=><article key={b.id}><div className="benefit-badges"><span>{kinds[b.kind]}</span>{b.inItinerary&&<strong>일정 속 장소</strong>}{b.audience&&<strong>{b.audience==='foreign'?'외국인 전용':'거주자 한정'}</strong>}</div><h4>{b.title}</h4><p>{b.summary}</p>{b.until&&<p className="benefit-period">{b.from} ~ {b.until}</p>}<details><summary>이용 조건</summary><p>{b.conditions}</p><small>{b.provider} · 안내 확인 {benefitsReviewedAt}</small></details><a href={b.url} target="_blank" rel="noreferrer">{b.kind==='resident'?'발급·가맹점 보기':b.kind==='pass'?'이용권·포함 시설 보기':b.kind==='discount'?'할인 조건·이용 방법':'최신 혜택 보기'} ↗</a></article>)}</div>
 {all.length>3&&<button type="button" className="text-button" onClick={()=>setExpanded(v=>!v)}>{expanded?'접기':`혜택 ${all.length-3}개 더 보기`}</button>}
 {today&&!all.length&&<p>등록된 혜택이 없거나 여행 날짜와 맞지 않습니다. 지역을 선택하거나 공식 목록에서 찾아보세요.</p>}
 <div className="benefit-links"><a href="https://korean.visitkorea.or.kr/travelmonth/benefit.do" target="_blank" rel="noreferrer">전국 공식 할인 모아보기</a><a href="https://korean.visitkorea.or.kr/dgtourcard/" target="_blank" rel="noreferrer">관광주민증 참여지역 보기</a></div><small>대상·잔여 수량에 따라 적용 여부가 달라집니다. 할인액은 예상 비용에서 자동 차감하지 않습니다.</small></details></section>;
}

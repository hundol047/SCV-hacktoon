'use client';
import {halfPriceForRegion,halfPriceState,halfPriceSource,halfPriceCheckedAt} from '../domain/half-price-travel';
import type {Trip} from '../domain/schema';
import HalfPriceDocuments from './HalfPriceDocuments';
import {useKoreaToday} from './useKoreaToday';
export default function HalfPriceTravel({region,date,trip}:{region:string;date:string;trip?:Trip}){
 const today=useKoreaToday();const rounds=halfPriceForRegion(region);
 if(!rounds.length)return null;
 return <aside className="half-price-travel" aria-label="정부 반값여행 지원"><h3>여행비 부담도 덜어 보세요</h3><p>정부·지자체 지역사랑 휴가지원 · 인정 여행경비의 50%를 지역화폐로 환급하는 사업이에요.</p>{rounds.map(p=><div key={p.city} className="half-price-round"><strong>{p.city} 반값여행 · {p.round}</strong><span>{today?halfPriceState(p,date,today):'공고 기간 확인'}</span><small>방문 기간 {p.from} ~ {p.until}</small><p>{p.conditions}</p>{trip&&<HalfPriceDocuments trip={trip} city={p.city}/>}</div>)}<details><summary>신청 전 확인할 조건</summary><ul><li>여행 전에 신청·승인을 받고, 여행 후 정해진 기한 안에 영수증과 방문 증빙을 제출하세요.</li><li>주민등록상 거주지와 인접 지역은 제한될 수 있어요. 출발지 주소만으로 자격을 판단하지 않아요.</li><li>일반 기준 개인 최대 10만원·2인 이상 최대 20만원. 청년·가족 유형의 한도와 조건은 지역 공고에서 확인하세요.</li><li>예산 소진 시 조기 마감될 수 있어요. 지원금은 사후 지역화폐 환급으로, 현재 예상 여행비에는 차감하지 않아요.</li></ul></details><a href={halfPriceSource} target="_blank" rel="noreferrer">공식 안내에서 지역 선택·신청하기 ↗</a><small className="policy-source">한국관광공사 · 공고 확인 {halfPriceCheckedAt} · 실시간 잔여 예산은 신청처에서 확인</small></aside>;
}

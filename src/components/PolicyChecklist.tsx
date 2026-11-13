'use client';
import {useState} from 'react';
import type {Trip} from '../domain/schema';
import type {TripEvidence} from '../domain/trip-evidence';
import {policyChecklist} from '../domain/policy-checklist';
import {halfPriceSource} from '../domain/half-price-travel';
export default function PolicyChecklist({trip,city,rows}:{trip:Trip;city:string;rows:TripEvidence[]}){
 const data=policyChecklist(trip,city,rows);const [deadline,setDeadline]=useState('');
 return <details className="policy-checklist"><summary>지역별 제출 준비 점검</summary><p>{data.round?.conditions}</p><ul>{data.items.map(i=><li key={i.label}><strong>{i.label} · {i.ready?'자료 있음':'보완 필요'}</strong><p>{i.detail}</p></li>)}</ul><p>사전 승인 내역, 거주지·신청 유형 증명, 대표자 결제수단, 지정 관광지 해당 여부를 공식 공고와 대조하세요. 숙박했다면 숙박확인서도 확인하세요.</p><label>승인 안내에서 확인한 제출 마감일<input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label>{deadline&&<p>제출 예정 마감: {deadline}{deadline<new Date().toISOString().slice(0,10)?' · 기한이 지났어요. 담당 기관에 문의하세요.':''}</p>}<a href={halfPriceSource} target="_blank" rel="noreferrer">공식 공고·서식 확인</a><p>이 점검 결과는 지원 자격·지급 승인 판정이 아닙니다. 원본과 초안은 아래 암호화 백업으로 함께 보관할 수 있어요.</p></details>;
}

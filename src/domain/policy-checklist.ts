import type {Trip} from './schema';
import {dayDate} from './schema';
import {evidenceSummary,type TripEvidence} from './trip-evidence';
import {halfPriceRounds} from './half-price-travel';
export function policyChecklist(trip:Trip,city:string,rows:TripEvidence[]){
 const round=halfPriceRounds.find(r=>r.city===city);const all=evidenceSummary(rows.filter(r=>r.tripId===trip.id&&r.city===city));
 const from=dayDate(trip.basics,1),until=dayDate(trip.basics,trip.basics.days);
 const outside=all.confirmed.filter(r=>r.reading.date!<from||r.reading.date!>until);
 const proof=evidenceSummary(all.confirmed.filter(r=>r.reading.date!>=from&&r.reading.date!<=until));
 const minimum=city==='화천'?70000:city==='횡성'?100000:0;
 const visits=city==='영월'||city==='화천'?2:1;
 return {round,total:proof.total,outside,items:[{label:'확인한 영수증',detail:`${proof.receipts.length}건 · ${proof.total.toLocaleString('ko-KR')}원`,ready:proof.receipts.length>0},{label:'방문사진 수량',detail:`${proof.visits.length}건 / 공고상 관광지 ${visits}곳${city==='평창'?' (지정 유료 관광지)':''} · 사진 수가 방문지 수 또는 지정 관광지 적합성을 증명하지는 않아요.`,ready:proof.visits.length>=visits},{label:'결제액 조건',detail:minimum?`공고상 최소 ${minimum.toLocaleString('ko-KR')}원 · 제외 업종 등 인정 금액은 별도 확인`:'인정 업종·결제수단은 지역 공고 확인',ready:minimum?proof.total>=minimum:false},{label:'증빙 날짜',detail:outside.length?`여행기간 밖 증빙 ${outside.length}건 — 날짜 또는 여행기간 확인`:'확인된 증빙의 여행기간 일치 여부 점검',ready:proof.confirmed.length>0&&!outside.length}]};
}

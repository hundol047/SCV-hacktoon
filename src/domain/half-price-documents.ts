import type {Trip} from './schema';
import {dayDate,time} from './schema';
import {itineraryStops} from './itinerary-stops';
import {evidenceSummary,type TripEvidence} from './trip-evidence';
import {halfPriceSource} from './half-price-travel';
export function halfPriceDocuments(trip:Trip,city:string,evidence:TripEvidence[]=[]){
 const b=trip.basics;
 const proof=evidenceSummary(evidence.filter(e=>e.tripId===trip.id&&e.city===city));
 const oneLine=(s:string)=>s.replace(/[\r\n]/g,' ');
 const visits=proof.visits.length?proof.visits.map(e=>`- ${e.reading.date} ${oneLine(e.reading.label)} · 사진: ${oneLine(e.name)} (사용자 확인)`).join('\n'):'[방문한 곳·방문일을 인증사진과 대조해 입력]';
 const receipts=proof.receipts.length?proof.receipts.map(e=>`- ${e.reading.date} / ${oneLine(e.reading.label)} / ${e.reading.amount!.toLocaleString('ko-KR')}원 / ${oneLine(e.name)}`).join('\n'):'[결제일 / 가맹점명 / 결제수단 / 실제 결제금액 / 영수증 파일명]';
 const expense=proof.receipts.length?`${proof.total.toLocaleString('ko-KR')}원 (사용자가 확인한 증빙 합계 · 중복·제외 업종·인정 여부 별도 확인)`:'[영수증 기준으로 입력]';

 const schedule=Array.from({length:b.days},(_,i)=>{
  const day=i+1;const stops=itineraryStops(trip,day);
  return `${day}일차 · ${dayDate(b,day)}\n${stops.length?stops.map(s=>`- ${time(s.item.start)}~${time(s.item.end)} ${s.place.name}`).join('\n'):'- 방문 일정 입력 필요'}`;
 }).join('\n\n');
 const common=`사업 지역: ${city}\n여행기간: ${dayDate(b,1)} ~ ${dayDate(b,b.days)}\n여행 인원: ${b.travelers??1}명 (신청 유형과 인정 인원은 공고 확인)\n신청 대표자: [성명 입력]\n주민등록상 거주 시·군·구: [직접 입력 · 출발지와 다를 수 있음]\n신청 유형: [개인/단체/가족/청년 중 확인 후 입력]`;
 const budget=b.tripBudget??b.budget;
 return {
  plan:`[사전신청 여행계획 초안]\n${b.title}\n\n${common}\n\n여행 목적\n동행자와 함께 ${city}의 관광지를 둘러보고 지역의 음식과 문화를 경험하고자 합니다.\n\n예정 일정 (전체 여행 기준)\n${schedule}\n\n예산 계획\n${budget!=null?`설정한 전체 여행 예산: ${budget.toLocaleString('ko-KR')}원 (지원 인정액 또는 실제 결제액이 아님)`:'전체 예산: [계획 금액 입력]'}\n숙박: [숙소명·예약일·계획 금액 입력]\n식사·체험 등: [예정 사용처·계획 금액 입력]\n\n신청 전 확인\n지정 관광지 해당 여부, ${city} 내 인정 가맹점, 거주지 제한, 여행일과 신청 마감을 공식 공고에서 확인하세요. 다른 지역의 일정·지출은 자동으로 인정되지 않습니다.\n공식 안내: ${halfPriceSource}\n\n※ 이 문서는 일정 기반의 편집용 초안이며 공식 신청서나 승인 증명이 아닙니다. 제출 전에 빈칸과 변경된 일정을 확인하세요.`,
  settlement:`[여행 후 정산 설명 작성용 초안]\n${common}\n사전 승인번호: [승인 후 입력]\n실제 여행일: [여행 후 확인하여 입력]\n\n실제 방문 내역\n${visits}\n\n제출 검토할 경비 내역\n${receipts}\n추가 지출: [필요 시 입력]\n확인한 경비 합계: ${expense}\n요청 환급액: [지역별 인정 기준·한도 확인 후 입력]\n\n제출 설명\n${proof.confirmed.length?`첨부한 자료 중 방문사진 ${proof.visits.length}건과 영수증 ${proof.receipts.length}건의 내용을 확인하여 정산 검토를 요청합니다. 지원 대상 경비와 최종 환급액은 담당 기관의 심사에 따릅니다.`:"[승인된 여행을 실제로 완료한 후, 방문 사실과 결제 내역에 맞춰 작성하세요.]"}\n\n첨부 확인\n[ ] 사전 신청·승인 내역\n[ ] 공고가 정한 지정 관광지 방문 인증사진\n[ ] 대표자 명의 결제 영수증·결제내역\n[ ] 숙박확인서 (숙박한 경우 공고 확인)\n[ ] 거주지·가족관계 등 신청 유형별 요구 서류\n\n※ 일정에 담긴 방문 예정지를 실제 방문·결제 증빙으로 바꾸어 적지 않았습니다. 실제 여행 후 증빙으로 완성하고 공식 신청처에 제출하세요.\n공식 안내: ${halfPriceSource}`,
 };
}

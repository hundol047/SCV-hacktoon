// Source: Korea Tourism Organization, checked 2026-11-09.
// These are published rounds, not a live quota or eligibility API.
export const halfPriceSource='https://korean.visitkorea.or.kr/dgtourcard/tour50.do';
export const halfPriceCheckedAt='2026-11-09';
export const halfPriceRounds=[
 {city:'영월',round:'6차',from:'2026-11-07',until:'2026-11-22',status:'announced',conditions:'지정 관광지 2곳 방문. 결제·정산 서류는 지역 공고를 확인하세요.'},
 {city:'화천',round:'2차',from:'2026-11-01',until:'2026-11-30',status:'announced',conditions:'관광지 2곳 이상 방문·사진 인증, 7만원 이상 결제. 대표자 카드 사용 원칙이며 숙박 현금영수증은 예외 조건이 있어요.'},
 {city:'평창',round:'3차',from:'2026-10-01',until:'2026-10-31',status:'closed',conditions:'지정 유료 관광지 1곳 방문사진과 결제 영수증, 숙박 시 숙박확인서가 필요해요.'},
 {city:'횡성',round:'3차',from:'2026-10-01',until:'2026-10-31',status:'closed',conditions:'10만원 이상 결제, 지정 관광지 1곳 이상 인증. 대표자 카드·숙박확인서 등 증빙 조건이 있어요.'},
] as const;
export function halfPriceForRegion(region:string){return halfPriceRounds.filter(p=>new RegExp('(?:^|\\s)'+p.city+'(?:군)?(?=\\s|$)').test(region));}
function validDate(value:string){const n=Date.parse(value+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value;}
export function halfPriceState(p:typeof halfPriceRounds[number],date:string,today:string){
 if(!validDate(date)||!validDate(today))return '확인할 날짜를 선택하세요';
 if(today>p.until||p.status==='closed')return '해당 회차 마감 · 다음 공고 확인';
 if(date<today)return '지난 방문일 · 사전 신청 여부 확인';
 if(date<p.from||date>p.until)return '선택한 방문일은 공고 기간 밖이에요';
 if(today<halfPriceCheckedAt||Date.parse(today)-Date.parse(halfPriceCheckedAt)>7*86400000)return '접수 현황 재확인 필요';
 return '방문일이 공고 기간에 포함 · 잔여 접수 확인';
}

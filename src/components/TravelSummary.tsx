import type {Basics} from '../domain/schema';
import {dayWindow,isTravelOnlyDay} from '../domain/world';
export default function TravelSummary({basics,day}:{basics:Basics;day:number}){
 let rows=basics.transfers??[];try{const window=dayWindow(basics,day);rows=rows.filter(t=>Date.parse(t.departure)<window.end&&Date.parse(t.arrival)>window.start);}catch{return null;}
 if(!rows.length)return null;
 const format=(value:string,region:string)=>new Date(value).toLocaleString('ko-KR',{timeZone:basics.destinations?.find(d=>d.region===region)?.timezone??basics.timezone,dateStyle:'medium',timeStyle:'short'});
 return <section className="cloud-panel" aria-label="도시 간 이동"><h3>{isTravelOnlyDay(basics,day)?'이동만 하는 날':'도시 간 이동 기록'}</h3>{rows.map((t,i)=><div key={i}><p>{t.fromRegion} → {t.toRegion}</p><p>출발 {format(t.departure,t.fromRegion)} · 도착 {format(t.arrival,t.toRegion)}</p><a href={t.source} target="_blank" rel="noopener noreferrer">시간표 출처 확인</a></div>)}<p>사용자 시간표 기록입니다. 실제 운행·예약 상태와 이동 중 식사·휴식은 출발 전에 확인하세요.</p></section>;
}

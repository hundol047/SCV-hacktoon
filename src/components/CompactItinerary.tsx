'use client';
import {useState} from 'react';
import type {Trip} from '../domain/schema';
import {dayDate} from '../domain/schema';
const clock=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export default function CompactItinerary({trip}:{trip:Trip}){
 const [day,setDay]=useState(1);const b=trip.basics;const places=new Map(trip.catalog?.places.map(p=>[p.id,p]));
 const stops=trip.items.filter(i=>i.day===day&&i.kind!=='move'&&i.placeId&&places.has(i.placeId));
 const route=new URLSearchParams({api:'1',origin:b.departureRegion??b.region,destination:places.get(stops[0]?.placeId??'')?.name??b.region,travelmode:b.transport==='transit'?'transit':'driving'});
 return <section className="compact-itinerary" aria-label="여행 코스">
 <div className="trip-overview"><strong>{b.departureRegion?`${b.departureRegion} → `:''}{b.title.replace(/ 여행$/,'')}</strong><span>{b.travelers??1}명 · {b.transport==='taxi'?'택시':b.transport==='driving'?'자가용':'이동'}{b.transport==='taxi'?` ${Math.ceil((b.travelers??1)/4)}대 (4인승)`:''}</span></div>
 <div className="day-tabs">{Array.from({length:b.days},(_,i)=><button key={i} onClick={()=>setDay(i+1)} className={day===i+1?'active':''}>{i+1}일차 <span>{dayDate(b,i+1).slice(5)}</span></button>)}</div>
 <div className="compact-tools"><span>방문 예정 시간</span>{b.departureRegion&&day===1&&<a href={'https://www.google.com/maps/dir/?'+route} target="_blank" rel="noreferrer">출발지에서 길찾기</a>}</div>
 <ol className="compact-stops">{stops.map(i=>{const p=places.get(i.placeId!)!;const info=p.visitorInfo;return <li key={i.id}><time>{clock(i.start)}</time><div><h3>{p.name}</h3><p>{i.kind==='meal'?'식사':i.kind==='rest'?'휴식':'관광'} · {i.end-i.start}분{info?.address?` · ${info.address}`:''}</p><div className="stop-links"><a href={'https://map.naver.com/p/search/'+encodeURIComponent(p.name+' '+(info?.address??b.region))} target="_blank" rel="noreferrer">지도 보기</a>{info?.website&&/^https?:\/\//.test(info.website)&&<a href={info.website} target="_blank" rel="noreferrer">홈페이지</a>}</div>{(info?.hoursText||info?.phone||p.cost.value!=null)&&<details><summary>방문 정보</summary>{info?.hoursText&&<p>운영시간 {info.hoursText}</p>}{info?.phone&&<p>전화 {info.phone}</p>}{p.cost.value!=null&&<p>입장료 {p.cost.value.toLocaleString()}원</p>}</details>}</div></li>;})}</ol>
 </section>;
}

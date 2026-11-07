'use client';
import AccessFacts from './AccessFacts';
import {useEffect,useMemo,useState} from 'react';
import {z} from 'zod';
import type {Place} from '../data/demo';
import type {Trip} from '../domain/schema';
import {dayDate} from '../domain/schema';
import {itineraryStops} from '../domain/itinerary-stops';
import {dayRoadURL,parseDayRoad,type DayRoad} from '../domain/road-day';
import {publicTravelJSON} from '../adapters/public-travel';
import {haversineKm} from '../domain/taxi-plan';
import ArrivalTerminals from './ArrivalTerminals';
import {airOrSeaTrip} from '../domain/booking';
import {placeMapLink} from '../domain/place-map';
import DepartureHubs from './DepartureHubs';
import {useKoreaToday} from './useKoreaToday';
import PlaceBenefits from './PlaceBenefits';
import {selectBenefits,benefitsForPlace} from '../domain/travel-benefits';
import TravelBenefits from './TravelBenefits';
import TravelBookings from './TravelBookings';
import TripCoupons from './TripCoupons';
import LiveTripPanel from './LiveTripPanel';
import TripPlanningOptions from './TripPlanningOptions';
import TripEstimate from './TripEstimate';
import TripLodgings from './TripLodgings';
import RoadMap from './RoadMap';
import {indexCatalog} from '../data/catalog';
import TripShareActions from './TripShareActions';
const clock=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
const duration=(n:number)=>n>=60?`${Math.floor(n/60)}시간${n%60?` ${n%60}분`:''}`:`${n}분`;
const cache=new Map<string,DayRoad>();
export default function CompactItinerary({trip,onTrip}:{trip:Trip;onTrip?:(t:Trip)=>void}){
 const [day,setDay]=useState(1);const b=trip.basics;const stops=useMemo(()=>itineraryStops(trip,day),[trip,day]);const today=useKoreaToday();const benefits=today?selectBenefits(trip,day,'',today):[];
 const [details,setDetails]=useState<{key:string;places:Record<string,NonNullable<Place['visitorInfo']>>}|null>(null);
 const detailIds=JSON.stringify([...new Set(trip.items.map(i=>i.placeId).filter((id):id is string=>!!id&&/^(osm:|tourapi:)/.test(id)))].slice(0,20));
 useEffect(()=>{if(detailIds==='[]')return;const controller=new AbortController();fetch('/api/place-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:JSON.parse(detailIds)}),signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return z.object({places:z.record(z.string(),z.object({address:z.string().max(1000).optional(),hoursText:z.string().max(3000).optional(),phone:z.string().max(3000).optional(),website:z.string().max(3000).optional()}))}).parse(await r.json());}).then(data=>{if(!controller.signal.aborted)setDetails({key:detailIds,places:data.places});}).catch(()=>{});return()=>controller.abort();},[detailIds]);
 const vehicle=b.transport==='taxi'||b.transport==='driving';
 const first=stops[0]?.place;
 const far=!!b.departureCoordinates&&!!first&&(haversineKm(b.departureCoordinates,first)??0)>=60;
 const airSea=airOrSeaTrip(b);
 const includeDeparture=day===1&&far&&vehicle&&!airSea;
 const coordinates=useMemo(()=>{const locations=stops.map(s=>s.place);if(!first)return locations;const home={...first,...b.departureCoordinates!,id:'departure',name:b.departureRegion??'출발지'};if(includeDeparture)locations.unshift(home);if(vehicle&&!airSea&&b.departureCoordinates&&b.commutes?.some(c=>c.day===day&&c.kind==='homebound'))locations.push(home);return locations;},[stops,first,includeDeparture,vehicle,airSea,b.departureCoordinates,b.departureRegion,b.commutes,day]);
 let url='';try{if(vehicle)url=dayRoadURL(coordinates);}catch{}
 const [mapMessage,setMapMessage]=useState(''),[mapRetry,setMapRetry]=useState(0);
 const [road,setRoad]=useState<{url:string;data:DayRoad}|null>(null);
 useEffect(()=>{if(!url)return;setMapMessage('이동 경로를 불러오는 중…');const controller=new AbortController();let active=true;const saved=cache.get(url);if(saved){setRoad({url,data:saved});return;}publicTravelJSON(url,controller.signal).then(raw=>{const data=parseDayRoad(raw,coordinates);if(active){if(cache.size>100)cache.clear();cache.set(url,data);setRoad({url,data});}}).catch(()=>{if(active)setMapMessage('이동 경로를 불러오지 못했어요. 다시 조회하거나 길찾기 링크를 이용해 주세요.');});return()=>{active=false;controller.abort();};},[url,mapRetry]); // Coordinates are encoded in the route URL.
 const allLegs=road?.url===url?road.data.legs:[];
 const measured=stops.slice(0,-1).map((s,i)=>trip.catalog?indexCatalog(trip.catalog).getRoute(s.place.id,stops[i+1].place.id,b.transport):undefined);
 const legs=b.roadCheckedAt?measured.map(r=>r?.duration.value!=null?{duration:r.duration.value*60,distance:r.distanceM?.value??0}:null):includeDeparture?allLegs.slice(1):allLegs;
 const origin=b.departureCoordinates?`${b.departureCoordinates.latitude},${b.departureCoordinates.longitude}`:b.departureRegion??b.region;
 const destination=first?.latitude!=null&&first.longitude!=null?`${first.latitude},${first.longitude}`:first?.name??b.region;
 const route=new URLSearchParams({api:'1',origin,destination,travelmode:b.transport==='walk'?'walking':b.transport==='transit'?'transit':'driving'});
 return <section className="compact-itinerary" aria-label="여행 코스">
 <div className="trip-overview"><strong>{b.departureRegion?`${b.departureRegion} → `:''}{b.title.replace(/ 여행$/,'')}</strong><span>{b.travelers??1}명 · {b.transport==='taxi'?'택시':b.transport==='driving'?'자가용':b.transport==='walk'?'도보':'대중교통'}{b.transport==='taxi'?` ${Math.ceil((b.travelers??1)/4)}대 (4인승)`:''}</span></div>
 {b.commutes?.filter(c=>c.day===day).map(c=><p className="commute-summary" key={c.kind}>{c.kind==='outbound'?'출발지 → 첫 여행지':'마지막 여행지 → 출발지'} · {clock(c.depart)} → {clock(c.arrive)} · 도로 약 {c.minutes}분</p>)}{b.roadCheckedAt&&<p className="road-note">조회한 도로 시간 반영 · 실시간 교통 체증 제외 · 체류 시간은 장소 유형별 계획 기준입니다.</p>}
 <>{onTrip&&<LiveTripPanel trip={trip} onTrip={onTrip}/ >}{onTrip&&<TripPlanningOptions key={trip.id+':options:'+trip.revision} trip={trip} onTrip={onTrip}/>}</><TripEstimate key={`estimate:${trip.id}`} trip={trip} onTrip={onTrip}/>{onTrip&&<TripCoupons trip={trip} onTrip={onTrip}/>}<TripShareActions trip={trip} day={day} onTrip={onTrip}/><TravelBookings destination={b.title}/>
 <div className="day-tabs">{Array.from({length:b.days},(_,i)=><button key={i} onClick={()=>setDay(i+1)} className={day===i+1?'active':''}>{i+1}일차 <span>{dayDate(b,i+1).slice(5)}</span></button>)}</div>
 <TravelBenefits trip={trip} day={day}/>
 {day===1&&(far||airSea)&&<aside className="arrival-guide"><strong>먼 거리 이동 안내</strong>{includeDeparture&&allLegs[0]&&<p>첫 장소까지 차량 약 {duration(Math.ceil(allLegs[0].duration/60))} · {(allLegs[0].distance/1000).toFixed(0)}km (교통상황 미반영)</p>}{airSea?<><p>{b.departureRegion??'출발지'} → 공항·항구 → {b.region} → {first?.name}</p><p>항공·배편을 먼저 예약하고 도착 시각에 맞춰 여행 시작 시간을 선택하세요.</p></>:<><DepartureHubs origin={b.departureCoordinates!} name={b.departureRegion??'출발지'}/><p>{b.departureRegion} → 출발 터미널 → {b.region} 방면 도착 터미널 → {first?.name}</p><p><a href="https://www.bustago.or.kr/" target="_blank" rel="noreferrer">버스타고</a> · <a href="https://txbus.t-money.co.kr/" target="_blank" rel="noreferrer">시외버스 티머니</a>에서 출발·도착 터미널과 인원 {b.travelers??1}명을 선택해 노선과 시간을 확인한 뒤 예약하세요. 예매표의 도착 터미널에서 내려 첫 장소까지 택시나 시내버스로 이동하세요.</p><div className="stop-links"><a href={'https://map.kakao.com/link/search/'+encodeURIComponent(b.title.replace(/ 여행$/, '')+' 버스터미널')} target="_blank" rel="noreferrer">도착 터미널 찾기</a><a href="https://www.letskorail.com/" target="_blank" rel="noreferrer">열차편 확인</a></div><ArrivalTerminals region={b.title.replace(/ 여행$/,'')} destination={destination}/></>}</aside>}
 {b.days>1&&<TripLodgings key={'lodgings:'+trip.id} trip={trip} onTrip={onTrip}/>}
 <section className="itinerary-map" aria-label="일정 이동 경로"><h3>{day}일차 이동 경로</h3><p className="route-stop-order">{coordinates.map((p,i)=><span key={p.id+':'+i}>{i>0?' → ':''}{i+1}. {p.name}</span>)}</p>{vehicle&&coordinates.length>1&&url?(road?.url===url?<><RoadMap from={coordinates[0]} to={coordinates.at(-1)!} stops={coordinates} route={road.data}/><p className="road-note">차량 약 {duration(Math.ceil(road.data.seconds/60))} · {(road.data.distance/1000).toFixed(1)}km · 교통상황 미반영</p></>:<div className="route-map-placeholder"><p role="status">{mapMessage||'이동 경로를 불러오는 중…'}</p><button type="button" onClick={()=>setMapRetry(v=>v+1)}>경로 다시 조회</button></div>):<p>방문 장소가 한 곳이거나 경로 좌표가 부족합니다. 아래 장소별 지도 링크를 이용하세요.</p>}</section>
 <div className="compact-tools"><span>방문 예정 시간</span>{b.departureRegion&&day===1&&!airSea&&<a href={'https://www.google.com/maps/dir/?'+route} target="_blank" rel="noreferrer">출발지에서 길찾기</a>}</div>
 <ol className="compact-stops">{stops.map(({item:i,place:p,restMinutes},index)=>{const info={...p.visitorInfo,...(details?.key===detailIds?details.places[p.id]:{})};const next=stops[index+1];const minutes=legs[index]?Math.max(1,Math.ceil(legs[index].duration/60)):null;const gap=next?Math.max(0,next.item.start-i.end):0;const directions=next?new URLSearchParams({api:'1',origin:p.latitude!=null&&p.longitude!=null?`${p.latitude},${p.longitude}`:p.name,destination:next.place.latitude!=null&&next.place.longitude!=null?`${next.place.latitude},${next.place.longitude}`:next.place.name,travelmode:b.transport==='walk'?'walking':b.transport==='transit'?'transit':'driving'}):null;return <li key={i.id}><time>{clock(i.start)}<small>~{clock(i.end)}</small></time><div><h3>{i.label??p.name}</h3>{i.label&&<p>{p.name}</p>}<AccessFacts place={p}/><PlaceBenefits benefits={benefitsForPlace(benefits,p.name)}/>{(b.coupons??[]).filter(c=>c.placeId===p.id&&c.day===day&&c.until>=dayDate(b,day)&&!!today&&c.until>=today).map(c=><p className="place-benefit" key={c.id}><a href={c.url} target="_blank" rel="noreferrer">{c.title} · 전체 {c.amount.toLocaleString()}원 할인</a><small>{c.conditions} · 직접 확인 · {c.until}까지</small></p>)}<p>{i.kind==='meal'?'식사':i.kind==='rest'?'휴식':'관광'} · {i.end-i.start-restMinutes}분{restMinutes?` + 휴식 ${restMinutes}분`:''}{info?.address?` · ${info.address}`:''}</p><div className="stop-links"><a href={placeMapLink(p)} target="_blank" rel="noreferrer">지도 보기</a>{info?.website&&/^https?:\/\//.test(info.website)&&<a href={info.website} target="_blank" rel="noreferrer">홈페이지</a>}</div>{(info?.hoursText||info?.phone||p.cost.value!=null)&&<details><summary>방문 정보</summary>{info?.hoursText&&<p>운영시간 {info.hoursText}</p>}{info?.phone&&<p>전화 {info.phone}</p>}{p.cost.value!=null&&<p>입장료 {p.cost.value.toLocaleString()}원</p>}</details>}{next&&next.place.id!==p.id&&<div className="stop-transfer"><span aria-hidden="true">↓</span><div>{minutes!==null?<>차량 약 {duration(minutes)} · {(legs[index]!.distance/1000).toFixed(1)}km<small>교통상황 미반영{minutes>gap?` · 계획보다 ${minutes-gap}분 더 필요`:''}</small></>:<>이동 {duration(gap)} 배정<small>실제 소요 시간은 길찾기에서 확인</small></>}</div><a href={'https://www.google.com/maps/dir/?'+directions} target="_blank" rel="noreferrer">길찾기</a></div>}</div></li>;})}</ol>
 </section>;
}

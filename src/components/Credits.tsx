'use client';
import online from '../../public/images/korea/online.json';
import local from '../../public/images/korea/manifest.json';
import type {TourismPhoto} from '../domain/daily-photo';
import type {Trip} from '../domain/schema';
const photos=Array.from(new Map([...online,...local as TourismPhoto[]].map(p=>[p.id,p])).values());
export default function Credits({trip}:{trip?:Trip}){return <details className="credits"><summary>이용 안내</summary><div><p>장소·지도 자료: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap 기여자 · ODbL</a></p><p>방문 예정 시간은 편집 가능한 일정입니다. 운영시간은 장소의 최신 안내를 확인하세요.</p>{photos.map(p=><p key={p.id}>{p.place} · {p.author} · <a href={p.source} target="_blank" rel="noreferrer">원본</a> · <a href={p.licenseURL} target="_blank" rel="noreferrer">{p.license}</a> · 화면에 맞게 자름{p.thumbnail?' · 축소본':''}</p>)}{trip?.catalog?.collectedAt&&<p>장소 자료 기준: {trip.catalog.collectedAt.slice(0,10)}</p>}{trip?.basics.departureCoordinates&&<p>출발 위치는 입력 지역의 장소 자료로 계산한 대략적인 중심입니다. 정확한 출발 주소와 이동시간은 길찾기에서 확인하세요.</p>}</div></details>;}

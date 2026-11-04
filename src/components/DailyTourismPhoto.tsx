'use client';
import {useEffect,useState} from 'react';
import online from '../../public/images/korea/online.json';
import manifest from '../../public/images/korea/manifest.json';
import {dailyPhoto,untilKoreaMidnight,type TourismPhoto} from '../domain/daily-photo';
const photos=manifest.length?manifest as TourismPhoto[]:online;
export default function DailyTourismPhoto(){
 const [now,setNow]=useState<number|null>(null),[offset,setOffset]=useState(0),[playing,setPlaying]=useState(false),[failed,setFailed]=useState<string[]>([]);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const update=()=>{const time=Date.now();setNow(time);clearTimeout(timer);timer=setTimeout(update,untilKoreaMidnight(time)+20);};update();document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);const motion=matchMedia('(prefers-reduced-motion: reduce)');const respect=()=>setPlaying(!motion.matches);respect();motion.addEventListener('change',respect);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);motion.removeEventListener('change',respect);};},[]);
 const available=photos.filter(p=>!failed.includes(p.id));const base=now===null?undefined:dailyPhoto(available,now);const index=base?(available.indexOf(base)+offset%available.length+available.length)%available.length:0;const photo=base?available[index]:undefined;
 useEffect(()=>{if(!playing||available.length<2)return;const timer=setInterval(()=>{if(!document.hidden)setOffset(n=>n+1);},8000);return()=>clearInterval(timer);},[playing,available.length]);
 const move=(direction:number)=>{setPlaying(false);setOffset(n=>n+direction);};
 return <div className="daily-tourism-photo" role="region" aria-label="한국 관광지 사진">{photo?<><img referrerPolicy="no-referrer" key={photo.id} className="hero-photo" src={photo.image} width="477" height="720" fetchPriority="high" alt={`${photo.region} ${photo.place} 실제 관광지 사진`} onError={()=>setFailed(ids=>ids.includes(photo.id)?ids:[...ids,photo.id])}/><div className="photo-controls"><button type="button" aria-label="이전 관광지 사진" disabled={available.length<2} onClick={()=>move(-1)}>‹</button><span aria-live={playing?'off':'polite'}>{photo.place} · {photo.region}</span><button type="button" aria-label={playing?'사진 자동 전환 일시정지':'사진 자동 전환 시작'} disabled={available.length<2} onClick={()=>setPlaying(v=>!v)}>{playing?'Ⅱ':'▷'}</button><button type="button" aria-label="다음 관광지 사진" disabled={available.length<2} onClick={()=>move(1)}>›</button></div></>:now===null?<p className="photo-unavailable">한국 관광지 사진을 불러오는 중…</p>:<div className="photo-unavailable"><p>사진을 불러오지 못했습니다.</p><button type="button" onClick={()=>{setFailed([]);setOffset(0);}}>사진 다시 불러오기</button></div>}</div>;
}

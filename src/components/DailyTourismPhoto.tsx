'use client';
import {useEffect,useState} from 'react';
import manifest from '../../public/images/korea/manifest.json';
import {dailyPhoto,untilKoreaMidnight,type TourismPhoto} from '../domain/daily-photo';
const photos=manifest as TourismPhoto[];
export default function DailyTourismPhoto(){
 const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const update=()=>{const time=Date.now();setNow(time);clearTimeout(timer);timer=setTimeout(update,untilKoreaMidnight(time)+20);};update();document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);};},[]);
 const photo=now===null?undefined:dailyPhoto(photos,now);
 return <div className="daily-tourism-photo">{photo?<><img key={photo.id} className="hero-photo" src={photo.image} width="477" height="720" fetchPriority="high" alt={`${photo.region} ${photo.place} 실제 관광지 사진`}/><p className="photo-credit">{photo.place} · {photo.region}<br/>촬영자 {photo.author}<br/><a href={photo.source} target="_blank" rel="noreferrer">출처 · Wikimedia Commons</a> · <a href={photo.licenseURL} target="_blank" rel="noreferrer">{photo.license}</a>{photo.thumbnail?' · 축소본':''}</p></>:<p className="photo-unavailable">한국 관광지 사진을 준비하고 있습니다.</p>}</div>;
}

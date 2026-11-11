'use client';
import {useEffect,useRef} from 'react';
import chapters from '../data/guide-chapters.json';
export default function UsageVideo(){
 const video=useRef<HTMLVideoElement>(null);
 useEffect(()=>{const element=video.current;if(!element||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)element.play().catch(()=>{});else element.pause();},{threshold:0.5});observer.observe(element);return()=>observer.disconnect();},[]);
 function seek(at:number){if(!video.current)return;video.current.currentTime=at;video.current.play().catch(()=>{});}
 return <section className="usage-video" aria-labelledby="usage-video-title"><div><span className="eyebrow">보폭 사용 방법</span><h2 id="usage-video-title">함께 떠날 준비, 보폭으로</h2><p>동행자 맞춤 일정부터 반값여행 신청 글과 영수증 정리까지.</p></div><video ref={video} controls muted loop playsInline preload="metadata" poster="/videos/travel-guide-poster.jpg?v=20261109-comfort-evidence" aria-label="보폭 사용 방법 영상"><source src="/videos/travel-guide.mp4?v=20261109-comfort-evidence" type="video/mp4"/><track kind="captions" src="/videos/travel-guide.ko.vtt?v=20261109-comfort-evidence" srcLang="ko" label="한국어"/><track kind="chapters" src="/videos/travel-guide.chapters.vtt?v=20261109-comfort-evidence" srcLang="ko" label="장면 선택"/>브라우저에서 영상을 재생할 수 없습니다.</video><nav className="video-chapters" aria-label="시연 영상 장면 선택">{chapters.map((c,i)=><button key={c.at} onClick={()=>seek(c.at)}><span>{String(i+1).padStart(2,'0')}</span>{c.label}</button>)}</nav></section>;
}

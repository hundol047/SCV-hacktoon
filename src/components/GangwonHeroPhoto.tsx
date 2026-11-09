'use client';
import {useState} from 'react';
// Place/photo pairs from MY-AI-LAB public/photos.json, commit 7f24645.
const photos=[
 {name:'강릉 경포해변',url:'https://tong.visitkorea.or.kr/cms/resource/25/4075925_image2_1.jpg'},
 {name:'양양 설악산 주전골',url:'https://tong.visitkorea.or.kr/cms/resource/38/4007638_image2_1.jpg'},
 {name:'강릉 경포대',url:'https://tong.visitkorea.or.kr/cms/resource/32/4119532_image2_1.jpg'},
];
export default function GangwonHeroPhoto(){
 const [index,setIndex]=useState(0),[failed,setFailed]=useState<string[]>([]);
 const available=photos.filter(p=>!failed.includes(p.url));const photo=available[index%available.length];
 return <div className="daily-tourism-photo" aria-label="강원 관광지 사진">{photo?<><img className="hero-photo" src={photo.url} alt={photo.name} fetchPriority="high" referrerPolicy="no-referrer" onError={()=>setFailed(v=>[...v,photo.url])}/><div className="photo-controls"><button type="button" aria-label="이전 강원 사진" disabled={available.length<2} onClick={()=>setIndex(v=>(v+available.length-1)%available.length)}>‹</button><span aria-live="polite">{photo.name}</span><a href={photo.url} target="_blank" rel="noreferrer" aria-label="한국관광공사 사진 원본">© 한국관광공사</a><button type="button" aria-label="다음 강원 사진" disabled={available.length<2} onClick={()=>setIndex(v=>v+1)}>›</button></div></>:<div className="photo-controls"><span>강원의 바다와 산을 만나 보세요</span><button type="button" onClick={()=>{setFailed([]);setIndex(0);}}>사진 다시 보기</button></div>}</div>;
}

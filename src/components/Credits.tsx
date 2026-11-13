'use client';
import {useRef} from 'react';
import online from '../../public/images/korea/online.json';
import local from '../../public/images/korea/manifest.json';
import type {TourismPhoto} from '../domain/daily-photo';
import type {Trip} from '../domain/schema';
const photos=Array.from(new Map([...online,...local as TourismPhoto[]].map(p=>[p.id,p])).values());
export default function Credits(_props:{trip?:Trip}){const dialog=useRef<HTMLDialogElement>(null);return <div className="credits"><button type="button" className="text-button" aria-label="사진·지도 저작권" onClick={()=>dialog.current?.showModal()}>©</button><dialog ref={dialog} aria-labelledby="credits-title"><h2 id="credits-title">사진·지도 저작권</h2><p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap 기여자 · ODbL</a></p><p>강원 관광지 대표 사진 · © 한국관광공사 · <a href="https://tong.visitkorea.or.kr/cms/resource/25/4075925_image2_1.jpg" target="_blank" rel="noreferrer">경포해변</a> · <a href="https://tong.visitkorea.or.kr/cms/resource/38/4007638_image2_1.jpg" target="_blank" rel="noreferrer">주전골</a> · <a href="https://tong.visitkorea.or.kr/cms/resource/32/4119532_image2_1.jpg" target="_blank" rel="noreferrer">경포대</a></p>{photos.map(p=><p key={p.id}>{p.place} · {p.author} · <a href={p.source} target="_blank" rel="noreferrer">원본</a> · <a href={p.licenseURL} target="_blank" rel="noreferrer">{p.license}</a> · 화면에 맞게 자름{p.thumbnail?' · 축소본':''}</p>)}<button type="button" onClick={()=>dialog.current?.close()}>닫기</button></dialog></div>;}

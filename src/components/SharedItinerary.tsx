'use client';
import {useEffect,useState} from 'react';
import type {Trip} from '../domain/schema';
import {decodePlan,sharedTrip,publicPlanSchema} from '../domain/shared-plan';
import CompactItinerary from './CompactItinerary';
import GroupOpinions from './GroupOpinions';
import LiveTripPanel from './LiveTripPanel';
import Credits from './Credits';
export default function SharedItinerary(){const [trip,setTrip]=useState<Trip|null>(null),[error,setError]=useState('');useEffect(()=>{let version=0;const read=()=>{const current=++version;setTrip(null);setError('');(async()=>{const match=location.hash.match(/^#live=([a-f0-9]{64})$/);if(match){const r=await fetch('/api/live-trip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'read',token:match[1]})});const d=await r.json();if(!r.ok)throw Error(d.error);const next=sharedTrip(publicPlanSchema.parse(d.document));if(version===current)setTrip({...next,revision:d.revision,basics:{...next.basics,liveToken:match[1]}});}else{const p=await decodePlan(location.hash);if(version===current)setTrip(sharedTrip(p));}})().catch(()=>{if(version===current)setError('공유 링크가 올바르지 않거나 지원되지 않습니다. 전체 링크를 다시 받아 열어 주세요.');});};read();window.addEventListener('hashchange',read);return()=>{version++;window.removeEventListener('hashchange',read);};},[]);return <main className="shared-itinerary"><a href="/">여행잇 홈</a>{trip?<><span className="eyebrow">공유받은 일정</span><h1>{trip.basics.title}</h1><p>{trip.basics.date} · {trip.basics.days}일 · {trip.basics.travelers}명</p><LiveTripPanel trip={trip} onTrip={setTrip} readOnly/><CompactItinerary trip={trip}/><GroupOpinions trip={trip}/></>:<p role="status">{error||'공유 일정을 여는 중…'}</p>}<Credits/></main>;}

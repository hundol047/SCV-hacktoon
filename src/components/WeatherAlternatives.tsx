'use client';
import {useState} from 'react';
import type {Trip} from '../domain/schema';
import {dayDate} from '../domain/schema';
import {forecastWeather} from '../domain/live-weather';
import {weatherLabels,type Weather} from '../domain/weather';
import {removePlan} from '../domain/course-plans';
import {indoorAlternative} from '../domain/indoor-alternative';
import LiveWeather from './LiveWeather';
export default function WeatherAlternatives(props:{trip:Trip;onTrip:(t:Trip)=>void}){const [day,setDay]=useState(1);if(props.trip.basics.mode!=='real')return null;return <details className="cloud-panel weather-alternatives"><summary>날씨 확인·실내 대안</summary><WeatherPanel key={`${props.trip.id}:${props.trip.revision}:${day}`} day={Math.min(day,props.trip.basics.days)} setDay={setDay} {...props}/></details>;}
function WeatherPanel({trip,onTrip,day,setDay}:{trip:Trip;onTrip:(t:Trip)=>void;day:number;setDay:(day:number)=>void}){
 const [preview,setPreview]=useState<ReturnType<typeof indoorAlternative>|null>(null),[error,setError]=useState('');
 if(trip.basics.mode!=='real')return null;
 const pref=trip.basics.coursePreferences?.find(p=>p.day===day),first=trip.items.find(i=>i.day===day&&i.kind==='visit'),place=trip.catalog?.places.find(p=>p.id===(pref?.originId??first?.placeId));
 const change=(fields:Partial<NonNullable<Trip['basics']['coursePreferences']>[number]>)=>onTrip({...trip,revision:trip.revision+1,basics:{...removePlan(trip.basics,day),coursePreferences:[...(trip.basics.coursePreferences??[]).filter(p=>p.day!==day),{day,weather:'unknown',visitMinutes:60,...pref,...fields}]}});
 return <div><label>날씨 확인 여행일<select value={day} onChange={e=>{setDay(Number(e.target.value));setPreview(null);setError('');}}>{Array.from({length:trip.basics.days},(_,i)=><option key={i} value={i+1}>{i+1}일차</option>)}</select></label>
 <LiveWeather key={day} place={place} date={dayDate(trip.basics,day)} saved={pref?.forecast} onApply={forecast=>change({weather:forecastWeather(forecast),forecast})}/>
 <details><summary>날씨 직접 선택</summary><label>대안 추천 날씨<select value={pref?.weather??'unknown'} onChange={e=>change({weather:e.target.value as Weather,forecast:undefined})}>{Object.entries(weatherLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></details>
 <button type="button" className="primary" onClick={()=>{try{setPreview(indoorAlternative(trip,day));setError('');}catch(e){setPreview(null);setError(e instanceof Error?e.message:'대안 비교 실패');}}}>실내 대안 보기</button>
 {preview&&<div><h3>{preview.date} · 실내 대안 비교</h3>{preview.changes.length?<><table><caption>확인 후 바뀔 장소</caption><thead><tr><th>현재</th><th>실내 대안</th></tr></thead><tbody>{preview.changes.map((c,i)=><tr key={i}><td>{c.before}</td><td>{c.after}</td></tr>)}</tbody></table><p>방문 시간과 고정 일정은 유지합니다. 교체된 구간의 도로 경로·비용은 다시 확인하세요.</p><button type="button" onClick={()=>{try{const checked=indoorAlternative(trip,day);if(JSON.stringify(checked.changes)!==JSON.stringify(preview.changes))throw Error('추천 조건이 달라졌습니다. 대안을 다시 확인하세요.');onTrip(checked.trip);}catch(e){setError((e as Error).message);}}}>비교한 실내 대안 적용</button></>:<p>교체할 실내 후보가 없거나 이미 실내 코스입니다.</p>}{preview.unavailable.length>0&&<><p>다음 장소는 바뀌지 않습니다. 방문 가능 여부를 따로 확인하세요.</p><ul>{preview.unavailable.map((v,i)=><li key={i}>{v}</li>)}</ul></>}</div>}
 <p role="status">{error}</p></div>;
}

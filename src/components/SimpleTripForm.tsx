'use client';
import {locationsSchema,type LocationResult} from '../domain/location';
import {createId} from '../domain/id';
import {useEffect,useRef,useState} from 'react';
import {defaultBasics,type Conditions,type Trip,type Basics} from '../domain/schema';
import {catalogSchema} from '../data/catalog';
import {validateBatch} from '../domain/course-batch';
import TravelBookings from './TravelBookings';
import DepartureHubs from './DepartureHubs';
import {generate} from '../domain/engine';
import {koreaRegions} from '../data/korea-tourism';

export default function SimpleTripForm({onTrip,conditions:baseConditions,initialTransport='taxi'}:{onTrip:(trip:Trip)=>void;conditions:Conditions;initialTransport?:'taxi'|'driving'}){
 const [region,setRegion]=useState(''),[date,setDate]=useState(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())),[days,setDays]=useState(1),[transport,setTransport]=useState<'taxi'|'driving'>(initialTransport),[interests,setInterests]=useState<string[]>(baseConditions.experiences.length?[...baseConditions.experiences]:['자연 풍경']);
 const [daySession,setDaySession]=useState<'morning'|'afternoon'>('morning');
 const [departure,setDeparture]=useState(''),[travelers,setTravelers]=useState(2);
 const [locations,setLocations]=useState<LocationResult[]>([]),[selectedLocation,setSelectedLocation]=useState<LocationResult|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const revision=useRef(0);useEffect(()=>()=>{revision.current++;},[]);
 const latestDeparture=useRef(departure);latestDeparture.current=departure;
 const lookup=useRef<{query:string;promise:Promise<LocationResult[]>}|null>(null);
 function lookupDeparture(query:string){if(lookup.current?.query===query)return lookup.current.promise;const promise=(async()=>{const response=await fetch('/api/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});const data=await response.json();if(!response.ok)throw Error(data.error);return locationsSchema.parse(data.locations);})();lookup.current={query,promise};promise.catch(()=>{if(lookup.current?.promise===promise)lookup.current=null;});return promise;}
 async function previewDeparture(){const query=departure.trim();if(query.length<2||selectedLocation)return;try{const found=await lookupDeparture(query);if(latestDeparture.current.trim()!==query)return;if(found.length===1){setSelectedLocation(found[0]);setLocations([]);}else setLocations(found);}catch{/* The generate action reports lookup errors. */}}
 async function create(){const current=++revision.current;setBusy(true);setError('');try{
   if(!region.trim())throw Error('여행 지역을 입력해 주세요.');
   if(!departure.trim())throw Error('출발 지역을 입력해 주세요.');
   const found=koreaRegions.find(p=>region.includes(p.name)||region.includes(p.name.slice(0,2)));
   const q=found?region.replace(found.name,'').replace(found.name.slice(0,2),'').trim():region.trim();
   const [response,foundLocations]=await Promise.all([fetch('/api/tourism?'+new URLSearchParams({action:'catalog',province:found?.code??'',q,limit:'200'})),selectedLocation?Promise.resolve([selectedLocation]):lookupDeparture(departure.trim())]);
   const data=await response.json();if(!response.ok)throw Error(data.error);let catalog=catalogSchema.parse(data);
   if(!catalog.places.length)throw Error('관광지를 찾지 못했습니다. 시·군·구 또는 관광지 이름으로 검색하세요.');
   let origin=selectedLocation;
   if(!origin){
     if(current!==revision.current)return;
     if(!foundLocations.length)throw Error('일치하는 출발지를 찾지 못했습니다. 시·구 이름을 함께 입력하거나 도로명주소로 검색해 주세요.');
     if(foundLocations.length>1){setLocations(foundLocations);throw Error('아래 검색 결과에서 출발지를 선택한 뒤 다시 생성해 주세요.');}
     origin=foundLocations[0];setSelectedLocation(origin);setLocations([]);
   }
   const departureCoordinates={latitude:origin.latitude,longitude:origin.longitude};
   let basics:Basics={...defaultBasics,daySession,title:region.trim()+' 여행',departureRegion:departure.trim(),departureCoordinates,travelers,date,days,mode:'real',region:catalog.region,timezone:'Asia/Seoul',transport,travelPriority:'balanced'};
   const conditions={...baseConditions,experiences:[...interests]};
   const r=await fetch('/api/courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({basics,conditions,catalog,day:1,allDays:true,consent:true})});
   const raw=await r.json();if(!r.ok)throw Error(raw.error);if(current!==revision.current)return;
   basics=validateBatch(basics,conditions,catalog,raw).basics;
   const result=generate(conditions,basics,[],[],catalog);if(result.blocked&&!result.items.length)throw Error(result.reasons.join(' '));
   if(current===revision.current)onTrip({version:1,id:createId(),revision:0,conditions,basics,items:result.items,history:[],feedback:[],catalog});
 }catch(e){if(current===revision.current)setError(e instanceof Error?e.message:'일정을 만들지 못했습니다.');}finally{if(current===revision.current)setBusy(false);}}
 return <section className="simple-trip" aria-label="간편 AI 일정 입력"><h2>어디로 떠날까요?</h2><div className="field-grid">
 <label>출발 지역<input disabled={busy} value={departure} onBlur={previewDeparture} maxLength={120} placeholder="판교고등학교, 성남시 분당구 도로명주소" onChange={e=>{setDeparture(e.target.value);setSelectedLocation(null);setLocations([]);}}/></label>
 <label>여행 지역<input disabled={busy} value={region} maxLength={120} placeholder="서울 종로구, 강릉, 경주" onChange={e=>setRegion(e.target.value)}/></label>
 <label>출발 날짜<input disabled={busy} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label>여행 기간<select disabled={busy} value={days} onChange={e=>setDays(Number(e.target.value))}>{[1,2,3,4,5].map(d=><option key={d} value={d}>{d===1?'당일':`${d-1}박 ${d}일`}</option>)}</select></label>
 <label>여행 인원<select disabled={busy} value={travelers} onChange={e=>setTravelers(Number(e.target.value))}>{Array.from({length:20},(_,i)=><option key={i+1} value={i+1}>{i+1}명</option>)}</select></label>
 <label>이동 수단<select disabled={busy} value={transport} onChange={e=>setTransport(e.target.value as 'taxi'|'driving')}><option value="taxi">택시</option><option value="driving">자가용</option></select></label>
 <label>여행 시간대<select disabled={busy} value={daySession} onChange={e=>setDaySession(e.target.value as 'morning'|'afternoon')}><option value="morning">오전부터 · 09:00~18:30</option><option value="afternoon">오후부터 · 13:00~19:00</option></select></label>
 <fieldset className="interest-options" disabled={busy}><legend>여행 취향 <small>여러 개 선택할 수 있어요</small></legend><div><button type="button" aria-pressed={interests.length===0} onClick={()=>setInterests([])}>골고루</button>{[...new Set(['자연 풍경','문화·전시','지역 음식','사진 찍기','바다 보기','조용한 카페',...baseConditions.experiences])].map(value=><button type="button" key={value} aria-pressed={interests.includes(value)} onClick={()=>setInterests(current=>current.includes(value)?current.filter(v=>v!==value):current.length<12?[...current,value]:current)}>{value}</button>)}</div></fieldset>
 </div>
 <TravelBookings destination={region}/>
 {locations.length>1&&<fieldset className="location-options"><legend>어느 출발지인가요?</legend>{locations.map(location=><button key={location.id} type="button" disabled={busy} onClick={()=>{setSelectedLocation(location);setLocations([]);setError('');}}><strong>{location.name}</strong><span>{location.address}</span></button>)}</fieldset>}
 {selectedLocation&&<><p className="selected-location">출발지: {selectedLocation.address}</p><DepartureHubs origin={selectedLocation} name={selectedLocation.name}/></>}
 <button type="button" className="primary" disabled={busy} onClick={create}>{busy?'AI 일정 생성 중…':'지역 검색하고 AI 일정 생성'}</button>{error&&<p role="alert">{error}</p>}</section>;
}

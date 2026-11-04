'use client';
import {locationsSchema,type LocationResult} from '../domain/location';
import {createId} from '../domain/id';
import {useEffect,useRef,useState} from 'react';
import {defaultBasics,type Conditions,type Trip,type Basics} from '../domain/schema';
import {catalogSchema} from '../data/catalog';
import {regionalCourse} from '../domain/regional-course';
import {savePlan} from '../domain/course-plans';
import {generate} from '../domain/engine';
import {koreaRegions} from '../data/korea-tourism';

export default function SimpleTripForm({onTrip,conditions:baseConditions,initialTransport='taxi'}:{onTrip:(trip:Trip)=>void;conditions:Conditions;initialTransport?:'taxi'|'driving'}){
 const [region,setRegion]=useState(''),[date,setDate]=useState(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())),[days,setDays]=useState(1),[transport,setTransport]=useState<'taxi'|'driving'>(initialTransport),[interest,setInterest]=useState(baseConditions.experiences[0]??'자연 풍경');
 const [departure,setDeparture]=useState(''),[travelers,setTravelers]=useState(2);
 const [locations,setLocations]=useState<LocationResult[]>([]),[selectedLocation,setSelectedLocation]=useState<LocationResult|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const revision=useRef(0);useEffect(()=>()=>{revision.current++;},[]);
 async function create(){const current=++revision.current;setBusy(true);setError('');try{
   if(!region.trim())throw Error('여행 지역을 입력해 주세요.');
   if(!departure.trim())throw Error('출발 지역을 입력해 주세요.');
   const found=koreaRegions.find(p=>region.includes(p.name)||region.includes(p.name.slice(0,2)));
   const q=found?region.replace(found.name,'').replace(found.name.slice(0,2),'').trim():region.trim();
   const response=await fetch('/api/tourism?'+new URLSearchParams({action:'catalog',province:found?.code??'',q,limit:'200'}));
   const data=await response.json();if(!response.ok)throw Error(data.error);let catalog=catalogSchema.parse(data);
   if(!catalog.places.length)throw Error('관광지를 찾지 못했습니다. 시·군·구 또는 관광지 이름으로 검색하세요.');
   let origin=selectedLocation;
   if(!origin){
     const departureResponse=await fetch('/api/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:departure.trim()})});
     const departureData=await departureResponse.json();if(!departureResponse.ok)throw Error(departureData.error);
     if(current!==revision.current)return;
     const foundLocations=locationsSchema.parse(departureData.locations);
     if(!foundLocations.length)throw Error('일치하는 출발지를 찾지 못했습니다. 시·구 이름을 함께 입력하거나 도로명주소로 검색해 주세요.');
     if(foundLocations.length>1){setLocations(foundLocations);throw Error('아래 검색 결과에서 출발지를 선택한 뒤 다시 생성해 주세요.');}
     origin=foundLocations[0];setSelectedLocation(origin);setLocations([]);
   }
   const departureCoordinates={latitude:origin.latitude,longitude:origin.longitude};
   let basics:Basics={...defaultBasics,title:region.trim()+' 여행',departureRegion:departure.trim(),departureCoordinates,travelers,date,days,mode:'real',region:catalog.region,timezone:'Asia/Seoul',transport,travelPriority:'balanced'};
   const conditions={...baseConditions,experiences:interest?[interest]:[]};
   // Build every day in a temporary value. Failed/stale responses never replace a saved trip.
   for(let day=1;day<=days;day++){
     const r=await fetch('/api/courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({basics,conditions,catalog,day,consent:true})});
     const raw=await r.json();if(!r.ok)throw Error(`${day}일차: ${raw.error}`);if(current!==revision.current)return;
     basics=savePlan(basics,regionalCourse(basics,conditions,catalog,day,raw).plan);
   }
   try{
     const ids=[...new Set(basics.coursePlans?.flatMap(p=>p.selectedPlaceIds)??basics.taxiPlan?.selectedPlaceIds??[])].slice(0,20);
     const detailsResponse=await fetch('/api/place-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids}),signal:AbortSignal.timeout(10000)});
     if(detailsResponse.ok){const details=await detailsResponse.json();catalog=catalogSchema.parse({...catalog,places:catalog.places.map(p=>({...p,visitorInfo:{...p.visitorInfo,...details.places?.[p.id]}}))});}
   }catch{/* Existing source records remain usable if optional detail lookup fails. */}
   const result=generate(conditions,basics,[],[],catalog);if(result.blocked&&!result.items.length)throw Error(result.reasons.join(' '));
   if(current===revision.current)onTrip({version:1,id:createId(),revision:0,conditions,basics,items:result.items,history:[],feedback:[],catalog});
 }catch(e){if(current===revision.current)setError(e instanceof Error?e.message:'일정을 만들지 못했습니다.');}finally{if(current===revision.current)setBusy(false);}}
 return <section className="simple-trip" aria-label="간편 AI 일정 입력"><h2>어디로 떠날까요?</h2><div className="field-grid">
 <label>출발 지역<input disabled={busy} value={departure} maxLength={120} placeholder="판교고등학교, 성남시 분당구 도로명주소" onChange={e=>{setDeparture(e.target.value);setSelectedLocation(null);setLocations([]);}}/></label>
 <label>여행 지역<input disabled={busy} value={region} maxLength={120} placeholder="서울 종로구, 강릉, 경주" onChange={e=>setRegion(e.target.value)}/></label>
 <label>출발 날짜<input disabled={busy} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label>여행 기간<select disabled={busy} value={days} onChange={e=>setDays(Number(e.target.value))}>{[1,2,3,4,5].map(d=><option key={d} value={d}>{d===1?'당일':`${d-1}박 ${d}일`}</option>)}</select></label>
 <label>여행 인원<select disabled={busy} value={travelers} onChange={e=>setTravelers(Number(e.target.value))}>{Array.from({length:20},(_,i)=><option key={i+1} value={i+1}>{i+1}명</option>)}</select></label>
 <label>이동 수단<select disabled={busy} value={transport} onChange={e=>setTransport(e.target.value as 'taxi'|'driving')}><option value="taxi">택시</option><option value="driving">자가용</option></select></label>
 <label>여행 취향<select disabled={busy} value={interest} onChange={e=>setInterest(e.target.value)}><option value="">골고루</option><option>자연 풍경</option><option>문화·전시</option><option>지역 음식</option><option>사진 찍기</option><option>바다 보기</option><option>조용한 카페</option></select></label>
 </div>
 {locations.length>1&&<fieldset className="location-options"><legend>어느 출발지인가요?</legend>{locations.map(location=><button key={location.id} type="button" disabled={busy} onClick={()=>{setSelectedLocation(location);setLocations([]);setError('');}}><strong>{location.name}</strong><span>{location.address}</span></button>)}</fieldset>}
 {selectedLocation&&<p className="selected-location">출발지: {selectedLocation.address}</p>}
 <button type="button" className="primary" disabled={busy} onClick={create}>{busy?'AI 일정 생성 중…':'지역 검색하고 AI 일정 생성'}</button>{error&&<p role="alert">{error}</p>}</section>;
}

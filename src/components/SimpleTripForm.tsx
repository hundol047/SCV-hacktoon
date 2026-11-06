'use client';
import {locationResultSchema,locationsSchema,type LocationResult} from '../domain/location';
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
 const [startTime,setStartTime]=useState('09:00'),[endTime,setEndTime]=useState('18:30');
 const [departure,setDeparture]=useState(''),[travelers,setTravelers]=useState(2);
 const [locations,setLocations]=useState<LocationResult[]>([]),[selectedLocation,setSelectedLocation]=useState<LocationResult|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const revision=useRef(0);useEffect(()=>()=>{revision.current++;},[]);
 const [locating,setLocating]=useState(false),[locationMessage,setLocationMessage]=useState('');const locationRevision=useRef(0);useEffect(()=>()=>{locationRevision.current++;},[]);
 const latestDeparture=useRef(departure);latestDeparture.current=departure;
 const lookup=useRef<{query:string;promise:Promise<LocationResult[]>}|null>(null);
 function lookupDeparture(query:string){if(lookup.current?.query===query)return lookup.current.promise;const promise=(async()=>{const response=await fetch('/api/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});const data=await response.json();if(!response.ok)throw Error(data.error);return locationsSchema.parse(data.locations);})();lookup.current={query,promise};promise.catch(()=>{if(lookup.current?.promise===promise)lookup.current=null;});return promise;}
 async function previewDeparture(){const query=departure.trim();if(query.length<2||selectedLocation||locating)return;setLocationMessage('출발지를 검색하고 있어요.');try{const found=await lookupDeparture(query);if(latestDeparture.current.trim()!==query)return;if(found.length===1){setSelectedLocation(found[0]);setLocations([]);}else setLocations(found);setLocationMessage(found.length>1?'검색 결과에서 출발지를 선택해 주세요.':found.length?'출발지를 찾았어요.':'검색 결과가 없어요. 시·구 이름이나 도로명 건물번호를 함께 입력해 주세요.');}catch{if(latestDeparture.current.trim()===query)setLocationMessage('주소 검색이 지연되고 있어요. 주소 검색을 다시 눌러 주세요.');}}
 async function locateDeparture(){
  if(!window.isSecureContext){setLocationMessage('현재 위치는 HTTPS 주소에서 사용할 수 있어요. 출발지를 직접 입력해 주세요.');return;}
  if(!navigator.geolocation){setLocationMessage('이 브라우저에서는 위치를 확인할 수 없어요. 출발지를 직접 입력해 주세요.');return;}
  const request=++locationRevision.current;setLocating(true);setLocationMessage('현재 위치를 확인하고 있어요.');
  try{
   const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:60000}));
   const point={latitude:position.coords.latitude,longitude:position.coords.longitude};
   let location=locationResultSchema.safeParse({...point,id:'current-location',name:'현재 위치',address:'현재 위치'});
   if(!location.success)throw Error('현재 위치는 국내 출발지에서 사용할 수 있어요.');
   let selected=location.data;
   if(request!==locationRevision.current)return;
   try{const response=await fetch('/api/location/current',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(point),signal:AbortSignal.timeout(6500)});if(response.ok)selected=locationResultSchema.parse((await response.json()).location);}catch{/* Coordinates remain usable when address lookup is unavailable. */}
   if(request!==locationRevision.current)return;
   const label=selected.address==='현재 위치'?'현재 위치':selected.address.slice(0,120);
   latestDeparture.current=label;setDeparture(label);setSelectedLocation(selected);setLocations([]);setError('');
   setLocationMessage(selected.address==='현재 위치'?'현재 위치를 출발지로 설정했어요.': '현재 위치를 출발지에 입력했어요.');
  }catch(e){if(request===locationRevision.current)setLocationMessage(e instanceof Error?e.message:(e as GeolocationPositionError).code===1?'위치 권한을 허용한 뒤 다시 눌러 주세요. 직접 입력도 가능해요.':(e as GeolocationPositionError).code===3?'위치 확인 시간이 초과됐어요. 다시 시도하거나 직접 입력해 주세요.':'위치를 확인하지 못했어요. 휴대폰 위치 설정을 확인하거나 직접 입력해 주세요.');}
  finally{if(request===locationRevision.current)setLocating(false);}
 }
 async function create(){const current=++revision.current;setBusy(true);setError('');try{
   const minutes=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};const travelHours={start:minutes(startTime),end:minutes(endTime)};
   if(!startTime||!endTime||travelHours.end-travelHours.start<30)throw Error('같은 날 안에서 종료 시간을 시작보다 30분 이상 늦게 선택해 주세요.');
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
   let basics:Basics={...defaultBasics,travelHours,title:region.trim()+' 여행',departureRegion:departure.trim(),departureCoordinates,travelers,date,days,mode:'real',region:catalog.region,timezone:'Asia/Seoul',transport,travelPriority:'balanced'};
   const conditions={...baseConditions,experiences:[...interests]};
   const r=await fetch('/api/courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({basics,conditions,catalog,day:1,allDays:true,consent:true})});
   const raw=await r.json();if(!r.ok)throw Error(raw.error);if(current!==revision.current)return;
   basics=validateBatch(basics,conditions,catalog,raw).basics;
   const result=generate(conditions,basics,[],[],catalog);if(result.blocked&&!result.items.length)throw Error(result.reasons.join(' '));
   if(current===revision.current)onTrip({version:1,id:createId(),revision:0,conditions,basics,items:result.items,history:[],feedback:[],catalog});
 }catch(e){if(current===revision.current)setError(e instanceof Error?e.message:'일정을 만들지 못했습니다.');}finally{if(current===revision.current)setBusy(false);}}
 return <section className="simple-trip" aria-label="간편 AI 일정 입력"><h2>어디로 떠날까요?</h2><div className="field-grid">
 <div className="departure-field"><div className="departure-heading"><label htmlFor="departure-region">출발 지역</label><button type="button" disabled={busy||locating} onClick={previewDeparture}>주소 검색</button><button type="button" disabled={busy||locating} onClick={locateDeparture}>{locating?'위치 확인 중…':'현재 위치'}</button></div><input id="departure-region" disabled={busy} value={departure} onBlur={previewDeparture} maxLength={120} placeholder="판교고, 분당중, 성남시 판교역로 235" onChange={e=>{locationRevision.current++;setLocating(false);setLocationMessage('');latestDeparture.current=e.target.value;setDeparture(e.target.value);setSelectedLocation(null);setLocations([]);}}/>{locationMessage&&<p role="status" className="location-status">{locationMessage}</p>}</div>
 <label className="destination-field"><span className="destination-heading">여행 지역</span><input disabled={busy} value={region} maxLength={120} placeholder="서울 종로구, 강릉, 경주" onChange={e=>setRegion(e.target.value)}/></label>
 <label>출발 날짜<input disabled={busy} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label>여행 기간<select disabled={busy} value={days} onChange={e=>setDays(Number(e.target.value))}>{[1,2,3,4,5].map(d=><option key={d} value={d}>{d===1?'당일':`${d-1}박 ${d}일`}</option>)}</select></label>
 <label>여행 인원<select disabled={busy} value={travelers} onChange={e=>setTravelers(Number(e.target.value))}>{Array.from({length:20},(_,i)=><option key={i+1} value={i+1}>{i+1}명</option>)}</select></label>
 <label>이동 수단<select disabled={busy} value={transport} onChange={e=>setTransport(e.target.value as 'taxi'|'driving')}><option value="taxi">택시</option><option value="driving">자가용</option></select></label>
 {([{label:'여행 시작',value:startTime,set:setStartTime},{label:'여행 종료',value:endTime,set:setEndTime}]).map(({label,value,set})=><fieldset className="travel-time" key={label} disabled={busy}><legend>{label} 시간</legend><div><select aria-label={label+' 시'} value={value.split(':')[0]} onChange={e=>set(e.target.value+':'+value.split(':')[1])}>{Array.from({length:24},(_,h)=>String(h).padStart(2,'0')).map(h=><option key={h} value={h}>{h}시</option>)}</select><select aria-label={label+' 분'} value={value.split(':')[1]} onChange={e=>set(value.split(':')[0]+':'+e.target.value)}>{['00','10','20','30','40','50'].map(m=><option key={m} value={m}>{m}분</option>)}</select></div></fieldset>)}<p className="travel-hours-help">매일 선택한 시간 안에서 관광·이동·휴식을 배치해요. 종료는 같은 날, 시작보다 30분 이상 늦게 선택해 주세요.</p>
 <fieldset className="interest-options" disabled={busy}><legend>여행 취향 <small>여러 개 선택할 수 있어요</small></legend><div><button type="button" aria-pressed={interests.length===0} onClick={()=>setInterests([])}>골고루</button>{[...new Set(['자연 풍경','문화·전시','지역 음식','사진 찍기','바다 보기','조용한 카페',...baseConditions.experiences])].map(value=><button type="button" key={value} aria-pressed={interests.includes(value)} onClick={()=>setInterests(current=>current.includes(value)?current.filter(v=>v!==value):current.length<12?[...current,value]:current)}>{value}</button>)}</div></fieldset>
 </div>
 <TravelBookings destination={region}/>
 {locations.length>1&&<fieldset className="location-options"><legend>어느 출발지인가요?</legend>{locations.map(location=><button key={location.id} type="button" disabled={busy} onClick={()=>{setSelectedLocation(location);setLocations([]);setError('');}}><strong>{location.name}</strong><span>{location.address}</span></button>)}</fieldset>}
 {selectedLocation&&<><p className="selected-location">출발지: {selectedLocation.address}</p><DepartureHubs origin={selectedLocation} name={selectedLocation.name}/></>}
 <button type="button" className="primary" disabled={busy||locating} onClick={create}>{busy?'AI 일정 생성 중…':'지역 검색하고 AI 일정 생성'}</button>{error&&<p role="alert">{error}</p>}</section>;
}

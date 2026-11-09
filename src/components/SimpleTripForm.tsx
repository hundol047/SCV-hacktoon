'use client';
import {importPetRules,toolkitSchema,type Toolkit} from '../domain/travel-toolkit';
import {facilityNames,type Facility} from '../domain/venue-details';
import {locationResultSchema,locationsSchema,type LocationResult} from '../domain/location';
import {createId} from '../domain/id';
import {useEffect,useRef,useState} from 'react';
import {defaultBasics,tripSchema,type Conditions,type Trip,type Basics} from '../domain/schema';
import {catalogSchema} from '../data/catalog';
import {validateBatch} from '../domain/course-batch';
import VoiceTripInput from './VoiceTripInput';
import type {VoiceAIReply} from '../domain/voice-ai';
import TravelBookings from './TravelBookings';
import HalfPriceTravel from './HalfPriceTravel';
import DepartureHubs from './DepartureHubs';
import {generate} from '../domain/engine';
import {gangwonDistricts} from '../data/gangwon-areas';

export default function SimpleTripForm({onTrip,conditions:baseConditions,initialTransport='taxi'}:{onTrip:(trip:Trip)=>void;conditions:Conditions;initialTransport?:'taxi'|'driving'}){
 const [region,setRegion]=useState('강릉'),[date,setDate]=useState(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())),[days,setDays]=useState(1),[transport,setTransport]=useState<'taxi'|'driving'>(initialTransport),[interests,setInterests]=useState<string[]>(baseConditions.experiences.length?[...baseConditions.experiences]:['자연 풍경']);
 const [pet,setPet]=useState<Toolkit>(()=>toolkitSchema.parse({})),[petMessage,setPetMessage]=useState('');
 const [access,setAccess]=useState<Facility[]>([]);
 const [walkLimit,setWalkLimit]=useState(''),[restMinutes,setRestMinutes]=useState('20');
 const [comfort,setComfort]=useState(true);
 const [showOptions,setShowOptions]=useState(false);
 const [startTime,setStartTime]=useState('09:00'),[endTime,setEndTime]=useState('18:30');
 const [dailyTimes,setDailyTimes]=useState<Record<number,{start:string;end:string}>>({});
 const [startMode,setStartMode]=useState<'home'|'destination'>('destination'),[returnHome,setReturnHome]=useState(false),[returnTime,setReturnTime]=useState('20:00'),[budget,setBudget]=useState('');
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
 const [voiceRun,setVoiceRun]=useState(0);const handledVoice=useRef(0);
 function applyVoice(result:VoiceAIReply){if(busy||locating||result.action==='cancel'||result.action==='answer')return;const command=result.patch;if(command.departure!==null){locationRevision.current++;latestDeparture.current=command.departure;setDeparture(command.departure);setSelectedLocation(null);setLocations([]);setLocationMessage('');}if(command.region!==null)setRegion(command.region);if(command.date!==null)setDate(command.date);if(command.days!==null)setDays(command.days);if(command.travelers!==null)setTravelers(command.travelers);if(command.transport!==null)setTransport(command.transport);if(command.comfort!==null)setComfort(command.comfort);if(command.walkLimit!==null)setWalkLimit(String(command.walkLimit));if(command.restMinutes!==null)setRestMinutes(String(command.restMinutes));if(command.interests!==null)setInterests(command.interests);if(command.access!==null)setAccess(command.access);setError('');if(result.action==='generate'&&!result.questions.length)setVoiceRun(v=>v+1);}

 useEffect(()=>{if(voiceRun===handledVoice.current)return;handledVoice.current=voiceRun;if(!busy&&!locating)void create();},[voiceRun]);
 async function create(){const current=++revision.current;setBusy(true);setError('');try{
   const minutes=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};const travelHours={start:minutes(startTime),end:minutes(endTime)};
   if(!startTime||!endTime||travelHours.end-travelHours.start<30)throw Error('같은 날 안에서 종료 시간을 시작보다 30분 이상 늦게 선택해 주세요.');
   if(Object.entries(dailyTimes).some(([day,t])=>Number(day)<=days&&minutes(t.end)-minutes(t.start)<30))throw Error('날짜별 종료 시각은 시작보다 30분 이상 늦게 선택하세요.');
   if(!region.trim())throw Error('여행 지역을 입력해 주세요.');
   if(!departure.trim())throw Error('출발 지역을 입력해 주세요.');
   const q=region.trim();
   const [response,foundLocations]=await Promise.all([fetch('/api/tourism?'+new URLSearchParams({action:'catalog',province:'KR-42',q,limit:'200',accessibility:access.length?'true':'false'})),selectedLocation?Promise.resolve([selectedLocation]):lookupDeparture(departure.trim())]);
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
   let basics:Basics={...defaultBasics,travelHours,dailyHours:Object.entries(dailyTimes).filter(([day])=>Number(day)<=days).map(([day,t])=>({day:Number(day),hours:{start:minutes(t.start),end:minutes(t.end)}})),startMode,...(returnHome?{returnBy:minutes(returnTime)}:{}),...(budget?{budget:Number(budget),tripBudget:Number(budget)}:{}),title:region.trim()+' 여행',departureRegion:departure.trim(),departureCoordinates,travelers,date,days,mode:'real',region:catalog.region,timezone:'Asia/Seoul',transport,travelPriority:comfort||access.length?'comfort':'balanced',requiredFacilities:access,toolkit:pet};
   const conditions={...baseConditions,...(comfort?{activity:'slow' as const}:{}),experiences:[...interests],...(walkLimit?{maxWalkMin:Number(walkLimit)}:{}),...(restMinutes?{restMin:Number(restMinutes)}:{})};
   const r=await fetch('/api/courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({basics,conditions,catalog,day:1,allDays:true,consent:true})});
   const raw=await r.json();if(!r.ok)throw Error(raw.error);if(current!==revision.current)return;
   basics=validateBatch(basics,conditions,catalog,raw).basics;
   const prepared=await fetch('/api/prepare-trip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({basics,conditions,catalog})});const ready=await prepared.json();if(!prepared.ok)throw Error(ready.error);
   if(current===revision.current)onTrip({...tripSchema.parse(ready.trip),id:createId()});
 }catch(e){if(current===revision.current)setError(e instanceof Error?e.message:'일정을 만들지 못했습니다.');}finally{if(current===revision.current)setBusy(false);}}
 return <section className="simple-trip" aria-label="간편 AI 일정 입력"><h2>네 가지만 고르면 준비 끝</h2><p className="comfort-intro">어디서 출발해 언제, 어디로 떠날까요?</p><VoiceTripInput disabled={busy||locating} context={{departure,region,date,days,travelers,transport,comfort,walkLimit:walkLimit?Number(walkLimit):null,restMinutes:restMinutes?Number(restMinutes):null,interests,access}} onCommand={applyVoice}/><div className="field-grid simple-basics">
 <div className="departure-field"><div className="departure-heading"><label htmlFor="departure-region">출발 지역</label><button type="button" disabled={busy||locating} onClick={previewDeparture}>주소 검색</button><button type="button" disabled={busy||locating} onClick={locateDeparture}>{locating?'위치 확인 중…':'현재 위치'}</button></div><input id="departure-region" disabled={busy} value={departure} onBlur={previewDeparture} maxLength={120} placeholder="판교고, 분당중, 성남시 판교역로 235" onChange={e=>{locationRevision.current++;setLocating(false);setLocationMessage('');latestDeparture.current=e.target.value;setDeparture(e.target.value);setSelectedLocation(null);setLocations([]);}}/><p role="status" className="location-status">{locationMessage||'\u00a0'}</p></div>
 <label className="destination-field"><span className="destination-heading">여행 지역</span><select disabled={busy} value={region} onChange={e=>setRegion(e.target.value)}>{gangwonDistricts.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
 <label>출발 날짜<input disabled={busy} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label>여행 기간<select disabled={busy} value={days} onChange={e=>setDays(Number(e.target.value))}>{[1,2,3,4,5].map(d=><option key={d} value={d}>{d===1?'당일':`${d-1}박 ${d}일`}</option>)}</select></label>
</div><p className="simple-defaults">{travelers}명 · {transport==='taxi'?'택시':'자가용'} · {startTime}–{endTime} · 관광 후 {restMinutes||'기본'}분 휴식</p><details className="simple-options" open={showOptions}><summary onClick={e=>{e.preventDefault();setShowOptions(v=>!v);}}>상세 설정 <small>인원·시간·취향·이동 편의</small></summary><section className="comfort-choices" aria-label="동행자를 위한 이동 조건"><label className="check-row"><input type="checkbox" disabled={busy} checked={comfort} onChange={e=>setComfort(e.target.checked)}/>이동 부담을 줄이는 여유로운 일정</label><p>기본은 관광 후 20분 휴식이에요. 함께 가는 분에게 맞춰 시간을 바꿔 보세요.</p> <fieldset className="mobility-options" disabled={busy}><legend>필요한 이동 편의 <small>동행자에게 필요한 항목만 선택하세요</small></legend><div className="mobility-checks">{(['stepFree','wheelchair','ramp','gentleSlope','elevator','accessibleToilet'] as const).map(key=><label className="check-row" key={key}><input type="checkbox" checked={access.includes(key)} onChange={e=>setAccess(current=>e.target.checked?[...current,key]:current.filter(k=>k!==key))}/>{facilityNames[key]}</label>)}</div><p>선택한 시설이 최근 자료에서 확인된 장소만 추천해요. 경사로가 있다고 휠체어 이용이 가능한 것은 아니므로, 필요한 조건을 함께 선택하세요.</p><div className="field-grid"><label>연속 보행 시간 한도<select value={walkLimit} onChange={e=>setWalkLimit(e.target.value)}><option value="">지정 안 함</option>{[...new Set([5,10,15,20,30,...(walkLimit?[Number(walkLimit)]:[])])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n}분</option>)}</select></label><label>관광 후 휴식<select value={restMinutes} onChange={e=>setRestMinutes(e.target.value)}><option value="">기본 설정</option>{[...new Set([10,15,20,30,...(restMinutes?[Number(restMinutes)]:[])])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n}분</option>)}</select></label></div>{access.length>0&&<p>차량 길찾기는 휠체어 경로 안내가 아닙니다. 주차장부터 입구까지의 동선과 현장 상태는 방문 전에 확인하세요.</p>}</fieldset></section><div className="field-grid"> <label>여행 인원<select disabled={busy} value={travelers} onChange={e=>setTravelers(Number(e.target.value))}>{Array.from({length:20},(_,i)=><option key={i+1} value={i+1}>{i+1}명</option>)}</select></label>
 <label>이동 수단<select disabled={busy} value={transport} onChange={e=>setTransport(e.target.value as 'taxi'|'driving')}><option value="taxi">택시</option><option value="driving">자가용</option></select></label>
 {([{label:'여행 시작',value:startTime,set:setStartTime},{label:'여행 종료',value:endTime,set:setEndTime}]).map(({label,value,set})=><fieldset className="travel-time" key={label} disabled={busy}><legend>{label} 시간</legend><div><select aria-label={label+' 시'} value={value.split(':')[0]} onChange={e=>set(e.target.value+':'+value.split(':')[1])}>{Array.from({length:24},(_,h)=>String(h).padStart(2,'0')).map(h=><option key={h} value={h}>{h}시</option>)}</select><select aria-label={label+' 분'} value={value.split(':')[1]} onChange={e=>set(value.split(':')[0]+':'+e.target.value)}>{['00','10','20','30','40','50'].map(m=><option key={m} value={m}>{m}분</option>)}</select></div></fieldset>)}<p className="travel-hours-help">매일 선택한 시간 안에서 관광·이동·휴식을 배치해요. 종료는 같은 날, 시작보다 30분 이상 늦게 선택해 주세요.</p>
 <fieldset className="interest-options" disabled={busy}><legend>여행 취향 <small>여러 개 선택할 수 있어요</small></legend><div><button type="button" aria-pressed={interests.length===0} onClick={()=>setInterests([])}>골고루</button>{[...new Set(['자연 풍경','문화·전시','지역 음식','사진 찍기','바다 보기','조용한 카페','겨울 레저',...baseConditions.experiences])].map(value=><button type="button" key={value} aria-pressed={interests.includes(value)} onClick={()=>setInterests(current=>current.includes(value)?current.filter(v=>v!==value):current.length<12?[...current,value]:current)}>{value}</button>)}</div></fieldset>
 </div>
 <HalfPriceTravel region={region} date={date}/>
 <details className="lab-advanced"><summary>예산·출발·귀가 조건</summary><div className="field-grid"> <label>시작 시간 기준<select disabled={busy} value={startMode} onChange={e=>setStartMode(e.target.value as 'home'|'destination')}><option value="destination">첫 여행지에서 시작</option><option value="home">출발지에서 출발 · 차량 이동 포함</option></select></label>
 <label>여행 전체 예산 (원)<input disabled={busy} type="number" min="0" max="10000000" step="10000" placeholder="전체 인원 합계 · 선택 사항" value={budget} onChange={e=>setBudget(e.target.value)}/></label>
 <div className="return-home"><label className="check-row"><input type="checkbox" disabled={busy} checked={returnHome} onChange={e=>setReturnHome(e.target.checked)}/>마지막 날 출발지로 돌아올 시간 지정</label>{returnHome&&<label>귀가 완료 시간<select disabled={busy} value={returnTime} onChange={e=>setReturnTime(e.target.value)}>{Array.from({length:144},(_,n)=>`${String(Math.floor(n/6)).padStart(2,'0')}:${n%6}0`).map(t=><option key={t}>{t}</option>)}</select></label>}</div>

</div></details>
 {days>1&&<details className="travel-panel"><summary>날짜마다 다른 시간 선택</summary><p>첫날 도착 후 시작하거나 마지막 날 일찍 떠나는 일정에 맞춰 조정하세요.</p>{Array.from({length:days},(_,i)=>i+1).map(day=><div className="field-grid" key={day}>{(['start','end'] as const).map(k=><label key={k}>{day}일차 {k==='start'?'시작':'종료'}<select disabled={busy} value={dailyTimes[day]?.[k]??(k==='start'?startTime:endTime)} onChange={e=>setDailyTimes(v=>({...v,[day]:{...(v[day]??{start:startTime,end:endTime}),[k]:e.target.value}}))}>{Array.from({length:144},(_,n)=>`${String(Math.floor(n/6)).padStart(2,'0')}:${n%6}0`).map(t=><option key={t}>{t}</option>)}</select></label>)}</div>)}</details>}
 <details className="travel-panel"><summary>반려동물과 함께 여행하기</summary><a href="/templates/pet-places.csv" download>장소 조건 CSV 양식</a><label>동반 조건 CSV<input disabled={busy} type="file" accept=".csv,text/csv" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>500000)throw Error('500KB 이하 파일을 선택하세요.');const petRules=importPetRules(await file.text());setPet(v=>({...v,petRules}));setPetMessage(`${petRules.length}곳의 동반 조건을 불러왔어요.`);}catch(err){setPetMessage((err as Error).message);}}}/></label><label className="check-row"><input type="checkbox" disabled={busy||!pet.petRules.length} checked={pet.petOnly} onChange={e=>setPet(v=>({...v,petOnly:e.target.checked}))}/>CSV에서 동반 허용을 확인한 장소만 추천</label><p role="status">{petMessage}</p></details>
 <TravelBookings destination={region}/></details>
 {locations.length>1&&<fieldset className="location-options"><legend>어느 출발지인가요?</legend>{locations.map(location=><button key={location.id} type="button" disabled={busy} onClick={()=>{setSelectedLocation(location);setLocations([]);setError('');}}><strong>{location.name}</strong><span>{location.address}</span></button>)}</fieldset>}
 {selectedLocation&&<><p className="selected-location">출발지: {selectedLocation.address}</p><details><summary>주변 터미널·기차역 보기</summary><DepartureHubs origin={selectedLocation} name={selectedLocation.name}/></details></>}
 <button type="button" className="primary" disabled={busy||locating} onClick={create}>{busy?'AI 일정 생성 중…':'지역 검색하고 AI 일정 생성'}</button>{error&&<p role="alert">{error}</p>}</section>;
}

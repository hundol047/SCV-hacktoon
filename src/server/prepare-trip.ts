import {validateSchedule} from '../domain/validate';
import {type Basics,type Conditions,type Trip,tripSchema} from '../domain/schema';
import type {Catalog} from '../data/catalog';
import {savedPlans} from '../domain/course-plans';
import {tableURL,parseRoadTable} from '../domain/road-day';
import {roadFact} from '../domain/road-route';
import {realisticDay} from '../domain/realistic-day';
import {plannedDetails} from './planned-details';
import {airOrSeaTrip} from '../domain/booking';
import type {Place} from '../data/demo';
export async function prepareTrip(b:Basics,c:Conditions,input:Catalog,fetcher:typeof fetch=fetch):Promise<Trip>{
 if(!b.travelHours||!['taxi','driving'].includes(b.transport))throw Error('시작·종료 시간과 차량 이동 수단을 선택해 주세요.');
 if((b.startMode==='home'||b.returnBy!==undefined)&&(!b.departureCoordinates||airOrSeaTrip(b)))throw Error('항공·배편은 도착 후 여행지 시작을 선택하고, 귀가 시간 지정은 해제해 주세요. 차량으로 연결되는 국내 구간만 자동 계산합니다.');
 if(b.lodgings?.some(h=>h.night>=b.days)||b.dailyHours?.some(h=>h.day>b.days))throw Error('숙박일과 여행일을 확인해 주세요.');
 const plans=savedPlans(b);if(plans.length!==b.days)throw Error('날짜별 추천 코스가 필요합니다.');
 const ids=new Set(plans.flatMap(p=>p.orderedPlaceIds));const details=await plannedDetails(input.places.filter(p=>ids.has(p.id)),fetcher);
 const catalog:Catalog={...input,places:input.places.filter(p=>!p.id.startsWith('stay:')).map(p=>details.find(d=>d.id===p.id)??p),routes:[...input.routes]};
 const stays=(b.lodgings??[]).map(h=>{const fact={value:null,evidenceId:'stay:'+h.id,source:'https://www.visitkorea.or.kr',nature:'real' as const,checked:'unknown' as const};const p:Place={id:`stay:${h.night}:${h.id}`,name:h.name,latitude:h.latitude,longitude:h.longitude,kind:'rest',experiences:[],description:'선택한 숙소',visitorInfo:{address:h.address},walkMin:fact,walkM:fact,stairs:fact,seat:fact,foods:fact,cost:fact,hours:fact,situations:fact};catalog.places.push(p);return {h,p};});
 const basics:Basics={...b,roadCheckedAt:new Date().toISOString(),dayWindows:[],commutes:[],coursePlans:[],taxiPlan:undefined};
 const all:Trip['items']=[];
 const tables=await Promise.all(plans.map(async plan=>{const places=plan.orderedPlaceIds.filter(id=>!id.startsWith('stay:')).map(id=>catalog.places.find(p=>p.id===id)!);if(!places.length||places.some(p=>!p)||places.length>12)throw Error('추천 장소를 확인해 주세요.');const day=plan.day??1;
 const home=(day===1&&b.startMode==='home'||day===b.days&&b.returnBy!==undefined)?{...places[0],...b.departureCoordinates!,id:'departure',name:b.departureRegion??'출발지'}:null;
 const incoming=stays.find(s=>s.h.night===day-1),outgoing=stays.find(s=>s.h.night===day);
 const points=[...places,...(home?[home]:[]),...(incoming?[incoming.p]:[]),...(outgoing?[outgoing.p]:[])];
 if(points.length===1)return {plan,places,home,incoming,outgoing,points,table:null};
 const response=await fetcher(tableURL(points),{signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw Error('도로 시간 조회에 실패했습니다. 잠시 후 다시 생성해 주세요.');const text=await response.text();if(text.length>1000000)throw Error('도로 응답을 확인하지 못했습니다.');return {plan,places,home,incoming,outgoing,points,table:parseRoadTable(JSON.parse(text),points)};}));
 for(const {plan,places,home,incoming,outgoing,points,table} of tables){
  const day=plan.day??1,window=b.dailyHours?.find(w=>w.day===day)?.hours??b.travelHours;
  const minutes=(a:Place,d:Place)=>{const value=table?.durations[points.indexOf(a)][points.indexOf(d)];if(value==null)throw Error('연결되는 차량 도로가 없습니다. 출발지와 여행지를 확인하세요.');return Math.ceil(value/60);};
  if(table)for(let i=0;i<points.length;i++)for(let j=0;j<points.length;j++){if(i===j||points[i]===home||points[j]===home||table.durations[i][j]==null||table.distances[i][j]==null)continue;const fact=roadFact({distance:table.distances[i][j]!,seconds:table.durations[i][j]!,points:[],fromAccess:0,toAccess:0,fetchedAt:basics.roadCheckedAt!},points[i],points[j],b.transport as 'taxi'|'driving');catalog.routes=catalog.routes.filter(r=>r.id!==fact.id);catalog.routes.push(fact);}
  let start=window.start,end=window.end;
  const origin=incoming?.p??(day===1&&b.startMode==='home'?home:null);
  const depart=incoming?Math.max(window.start,incoming.h.checkOut):window.start;
  if(origin)start=depart+Math.max(...places.map(p=>minutes(origin,p)));
  if(home&&day===b.days&&b.returnBy!==undefined)end=Math.min(end,b.returnBy-Math.max(...places.map(p=>minutes(p,home))));
  if(outgoing){end-=15+Math.max(...places.map(p=>minutes(p,outgoing.p)));if(outgoing.h.checkIn+15>window.end)throw Error(`${day}일차 종료 시각보다 체크인 시각이 늦습니다.`);}
  if(start>=end)throw Error(`${day}일차 이동 후 여행할 시간이 없습니다. 여행 시간을 늘리거나 가까운 숙소·지역을 선택해 주세요.`);
  basics.dayWindows!.push({day,start,end});const rows=realisticDay(places,basics,c,catalog,day);
  const used=[...new Set(rows.filter(i=>i.placeId).map(i=>i.placeId!))];const retained=used.map(id=>places.find(p=>p.id===id)!);
  const rest=(p:Place,start:number,end:number,label:string):Trip['items'][number]=>({id:`stay:${day}:${label}`,day,start,end,kind:'rest',placeId:p.id,fromId:null,toId:null,transport:null,locked:false,mode:'real',label});
  const move=(a:Place,d:Place,start:number):Trip['items'][number]=>({id:`stay:${day}:${a.id}:${d.id}`,day,start,end:start+minutes(a,d),kind:'move',placeId:null,fromId:a.id,toId:d.id,transport:b.transport,locked:false,mode:'real'});
  if(incoming){all.push(rest(incoming.p,Math.max(0,depart-15),depart,'체크아웃'),move(incoming.p,retained[0],depart));}
  if(home&&day===1&&b.startMode==='home'){const first=retained[0],m=minutes(home,first);basics.commutes!.push({day,kind:'outbound',minutes:m,distanceKm:table!.distances[points.indexOf(home)][points.indexOf(first)]!/1000,depart:window.start,arrive:window.start+m});}
  all.push(...rows);
  if(outgoing){const last=retained.at(-1)!,leg=move(last,outgoing.p,rows.at(-1)!.end);all.push(leg);const checkIn=Math.max(leg.end,outgoing.h.checkIn);if(checkIn>leg.end)all.push(rest(outgoing.p,leg.end,checkIn,'체크인 전 여유 시간'));all.push(rest(outgoing.p,checkIn,checkIn+15,'체크인'));}
  basics.coursePlans!.push({...plan,selectedPlaceIds:used,orderedPlaceIds:used,startPlaceId:used[0],distanceBasis:'road',roadFetchedAt:basics.roadCheckedAt,distanceKm:retained.slice(1).reduce((n,p,i)=>n+(table?.distances[points.indexOf(retained[i])][points.indexOf(p)]??0)/1000,0)});
  if(home&&day===b.days&&b.returnBy!==undefined){const last=rows.at(-1)!,p=retained.at(-1)!,m=minutes(p,home);basics.commutes!.push({day,kind:'homebound',minutes:m,distanceKm:table!.distances[points.indexOf(p)][points.indexOf(home)]!/1000,depart:last.end,arrive:last.end+m});}
 }
 basics.taxiPlan=basics.coursePlans?.at(-1);
 // Remove obsolete hotel routes after changing a selection.
 const known=new Set(catalog.places.map(p=>p.id));catalog.routes=catalog.routes.filter(r=>known.has(r.fromId)&&known.has(r.toId));
 const report=validateSchedule(all,c,basics,catalog);const violations=report.issues.filter(i=>i.status==='violation'||i.status==='conflict');if(violations.length)throw Error(violations.slice(0,2).map(i=>i.message).join(' '));
 return tripSchema.parse({version:1,id:crypto.randomUUID(),revision:0,basics,conditions:c,catalog,items:all,history:[],feedback:[]});
}

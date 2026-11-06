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
 const plans=savedPlans(b);if(plans.length!==b.days)throw Error('날짜별 추천 코스가 필요합니다.');
 const ids=new Set(plans.flatMap(p=>p.orderedPlaceIds));const details=await plannedDetails(input.places.filter(p=>ids.has(p.id)),fetcher);
 const catalog:Catalog={...input,places:input.places.map(p=>details.find(d=>d.id===p.id)??p),routes:[...input.routes]};
 const basics:Basics={...b,roadCheckedAt:new Date().toISOString(),dayWindows:[],commutes:[],coursePlans:[],taxiPlan:undefined};
 const all:Trip['items']=[];
 // A bounded number of days is queried in parallel; each table supplies every possible skipped-stop connection.
 const tables=await Promise.all(plans.map(async plan=>{const places=plan.orderedPlaceIds.map(id=>catalog.places.find(p=>p.id===id)!);if(places.some(p=>!p)||places.length>12)throw Error('추천 장소를 확인해 주세요.');const day=plan.day??1;const home=(day===1&&b.startMode==='home'||day===b.days&&b.returnBy!==undefined)?{...places[0],...b.departureCoordinates!,id:'departure',name:b.departureRegion??'출발지'}:null;const points=home?[...places,home]:places;
 if(points.length===1)return {plan,places,home,table:null};
 const response=await fetcher(tableURL(points),{signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw Error('도로 시간 조회에 실패했습니다. 잠시 후 다시 생성해 주세요.');const text=await response.text();if(text.length>1000000)throw Error('도로 응답을 확인하지 못했습니다.');return {plan,places,home,table:parseRoadTable(JSON.parse(text),points)};}));
 for(const {plan,places,home,table} of tables){
  const day=plan.day??1;const homeIndex=places.length;
  const minutes=(a:number,d:number)=>{const value=table?.durations[a][d];if(value==null)throw Error('연결되는 차량 도로가 없습니다. 출발지와 여행지를 확인하세요.');return Math.ceil(value/60);};
  if(table)for(let i=0;i<places.length;i++)for(let j=0;j<places.length;j++){if(i===j||table.durations[i][j]==null||table.distances[i][j]==null)continue;const fact=roadFact({distance:table.distances[i][j]!,seconds:table.durations[i][j]!,points:[],fromAccess:0,toAccess:0,fetchedAt:basics.roadCheckedAt!},places[i],places[j],b.transport as 'taxi'|'driving');catalog.routes=catalog.routes.filter(r=>r.id!==fact.id);catalog.routes.push(fact);}
  let start=b.travelHours.start,end=b.travelHours.end;
  if(home&&day===1&&b.startMode==='home'){const m=Math.max(...places.map((_,i)=>minutes(homeIndex,i)));start+=m;if(start>=1440)throw Error('출발지 이동만으로 날짜가 넘어갑니다. 여행지에서 시작해 주세요.');}
  // Reserve enough time to return from any retained final venue; recalculate actual return after scheduling.
  if(home&&day===b.days&&b.returnBy!==undefined)end=Math.min(end,b.returnBy-Math.max(...places.map((_,i)=>minutes(i,homeIndex))));
  if(start>=end)throw Error('왕복 이동 후 여행할 시간이 없습니다. 여행 시간을 늘리거나 가까운 지역을 선택해 주세요.');
  basics.dayWindows!.push({day,start,end});const rows=realisticDay(places,basics,c,catalog,day);all.push(...rows);
  const used=[...new Set(rows.filter(i=>i.placeId).map(i=>i.placeId!))];const retained=used.map(id=>places.find(p=>p.id===id)!);
  if(home&&day===1&&b.startMode==='home'){const first=places.indexOf(retained[0]),m=minutes(homeIndex,first);basics.commutes!.push({day,kind:'outbound',minutes:m,distanceKm:table!.distances[homeIndex][first]!/1000,depart:b.travelHours.start,arrive:b.travelHours.start+m});}
  basics.coursePlans!.push({...plan,selectedPlaceIds:used,orderedPlaceIds:used,startPlaceId:used[0],distanceBasis:'road',roadFetchedAt:basics.roadCheckedAt,distanceKm:retained.slice(1).reduce((n,p,i)=>n+(table?.distances[places.indexOf(retained[i])][places.indexOf(p)]??0)/1000,0)});
  if(home&&day===b.days&&b.returnBy!==undefined){const last=rows.at(-1)!,i=places.findIndex(p=>p.id===last.placeId),m=minutes(i,homeIndex);basics.commutes!.push({day,kind:'homebound',minutes:m,distanceKm:table!.distances[i][homeIndex]!/1000,depart:last.end,arrive:last.end+m});}
 }
 basics.taxiPlan=basics.coursePlans?.at(-1);
 const report=validateSchedule(all,c,basics,catalog);const violations=report.issues.filter(i=>i.status==='violation'||i.status==='conflict');if(violations.length)throw Error(violations.slice(0,2).map(i=>i.message).join(' '));
 return tripSchema.parse({version:1,id:crypto.randomUUID(),revision:0,basics,conditions:c,catalog,items:all,history:[],feedback:[]});
}

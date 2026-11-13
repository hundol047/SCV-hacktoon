import {usableRestPlace} from './rest-place';
import type {Basics,Conditions,Item} from './schema';
import {dayDate} from './schema';
import type {Place} from '../data/demo';
import {indexCatalog,type Catalog} from '../data/catalog';
import {visitDuration} from './visit-duration';
import {closedOn,recentFact} from './venue-details';
export function realisticDay(selected:Place[],basics:Basics,conditions:Conditions,catalog:Catalog,day:number):Item[]{
 const window=basics.dayWindows?.find(w=>w.day===day)??basics.travelHours!;
 const venueWindow=(p:Place)=>{const opening=p.opening?.value&&recentFact(p.opening)?p.opening.value:null;return {open:Math.max(opening?.open??0,p.hours.value?.[0]??0),close:Math.min(opening?.close??1440,p.hours.value?.[1]??1440)};};
 const meals=selected.filter(p=>p.kind==='meal');
 const dinner=(meals.length>1||window.start>=900&&window.end>=1140)?meals.at(-1):undefined;
 const dinnerStart=Math.min(1140,window.end-60);
 let cursor=window.start;let last:Place|undefined;const items:Item[]=[];const date=dayDate(basics,day);
 const add=(p:Place,kind:Item['kind'],start:number,end:number,label?:string)=>items.push({id:`real:${day}:${items.length}`,day,start,end,kind,placeId:p.id,fromId:null,toId:null,transport:null,locked:false,mode:'real',...(label?{label}:{})});
 for(const p of selected){
  if(closedOn(p,date)||p===dinner&&window.end<1140)continue;
  const route=last?indexCatalog(catalog).getRoute(last.id,p.id,basics.transport):null;
  if(last&&route?.duration.value==null)throw Error('장소 간 도로 시간을 조회하지 못했습니다. 다시 생성해 주세요.');
  const move=last?Math.ceil(route!.duration.value!):0;
  let begin=cursor+move;if(p.kind==='meal')begin=Math.max(begin,p===dinner?Math.min(1080,dinnerStart):720);const hours=venueWindow(p);
  begin=Math.max(begin,hours.open);
  // Unknown opening times are not treated as verified availability.
  const rest=conditions.restMin??10;
  let ceiling=Math.min(window.end,hours.close-(p.kind==='visit'?rest:0));
  if(dinner&&window.end>=1140&&p!==dinner&&p.kind==='visit'&&selected.indexOf(p)<selected.indexOf(dinner)){
   const toDinner=indexCatalog(catalog).getRoute(p.id,dinner.id,basics.transport)?.duration.value;
   if(toDinner!=null)ceiling=Math.min(ceiling,dinnerStart-Math.ceil(toDinner)-(conditions.restMin??10));
  }
  const duration=visitDuration(p);
  if(begin+duration>ceiling)continue;
  // Arrive when the venue opens; do not record pre-opening waiting inside it.
  const moveStart=cursor+move<hours.open?begin-move:cursor;
  if(last&&usableRestPlace(last,basics.requiredFacilities)&&moveStart-cursor>=Math.max(1,rest)&&cursor>=venueWindow(last).open&&moveStart<=venueWindow(last).close)add(last,'rest',cursor,moveStart,'휴식');
  if(last&&move>0){items.push({id:`real:${day}:${items.length}`,day,start:moveStart,end:moveStart+move,kind:'move',placeId:null,fromId:last.id,toId:p.id,transport:basics.transport,locked:false,mode:'real'});}
  // Waiting until lunch or opening is an unallocated gap, not a verified rest stop.
  add(p,p.kind,begin,begin+duration,p.kind==='meal'?(p===dinner?'저녁 식사':'점심 식사'):undefined);cursor=begin+duration;last=p;
  if(p.kind==='visit'&&rest>0&&cursor+rest<=Math.min(window.end,hours.close)){if(usableRestPlace(p,basics.requiredFacilities))add(p,'rest',cursor,cursor+rest,'휴식');else items.push({id:`real:${day}:${items.length}`,day,start:cursor,end:cursor+rest,kind:'rest',placeId:null,fromId:null,toId:null,transport:null,locked:false,mode:'real',label:'휴식 장소 확인 필요'});cursor+=rest;}
 }
 if(!items.some(i=>i.kind==='visit'))throw Error('이동·체류·영업시간을 반영하면 방문 시간이 부족합니다. 시작을 앞당기거나 종료 시간을 늦춰 주세요.');
 return items;
}

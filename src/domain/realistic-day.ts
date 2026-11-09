import type {Basics,Conditions,Item} from './schema';
import {dayDate} from './schema';
import type {Place} from '../data/demo';
import {indexCatalog,type Catalog} from '../data/catalog';
import {visitDuration} from './visit-duration';
import {closedOn,recentFact} from './venue-details';
export function realisticDay(selected:Place[],basics:Basics,conditions:Conditions,catalog:Catalog,day:number):Item[]{
 const window=basics.dayWindows?.find(w=>w.day===day)??basics.travelHours!;
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
  let begin=cursor+move;if(p.kind==='meal')begin=Math.max(begin,p===dinner?Math.min(1080,dinnerStart):720);const hours=p.opening?.value&&recentFact(p.opening)?p.opening.value:null;
  if(hours)begin=Math.max(begin,hours.open);
  // Unknown opening times are not treated as verified availability.
  let ceiling=Math.min(window.end,hours?.close??window.end);
  if(dinner&&window.end>=1140&&p!==dinner&&p.kind==='visit'&&selected.indexOf(p)<selected.indexOf(dinner)){
   const toDinner=indexCatalog(catalog).getRoute(p.id,dinner.id,basics.transport)?.duration.value;
   if(toDinner!=null)ceiling=Math.min(ceiling,dinnerStart-Math.ceil(toDinner)-(conditions.restMin??10));
  }
  const duration=visitDuration(p);
  if(begin+duration>ceiling)continue;
  if(last&&move>0){items.push({id:`real:${day}:${items.length}`,day,start:cursor,end:cursor+move,kind:'move',placeId:null,fromId:last.id,toId:p.id,transport:basics.transport,locked:false,mode:'real'});}
  if(begin-cursor-move>=Math.max(1,conditions.restMin??10))add(p,'rest',cursor+move,begin,hours&&hours.open>cursor+move&&hours.open===begin?'운영 시작 전 여유 시간':p.kind==='meal'?'식사 전 휴식':'이동 후 휴식');
  add(p,p.kind,begin,begin+duration,p.kind==='meal'?(p===dinner?'저녁 식사':'점심 식사'):undefined);cursor=begin+duration;last=p;
  const rest=conditions.restMin??10;if(p.kind==='visit'&&cursor+rest<=window.end){add(p,'rest',cursor,cursor+rest,'휴식');cursor+=rest;}
 }
 if(!items.some(i=>i.kind==='visit'))throw Error('이동·체류·영업시간을 반영하면 방문 시간이 부족합니다. 시작을 앞당기거나 종료 시간을 늦춰 주세요.');
 return items;
}

import type {Basics,Conditions,Item} from './schema';
import {dayDate} from './schema';
import type {Place} from '../data/demo';
import {indexCatalog,type Catalog} from '../data/catalog';
import {visitDuration} from './visit-duration';
import {closedOn,recentFact} from './venue-details';
export function realisticDay(selected:Place[],basics:Basics,conditions:Conditions,catalog:Catalog,day:number):Item[]{
 const window=basics.dayWindows?.find(w=>w.day===day)??basics.travelHours!;
 let cursor=window.start;let last:Place|undefined;const items:Item[]=[];const date=dayDate(basics,day);
 const add=(p:Place,kind:Item['kind'],start:number,end:number,label?:string)=>items.push({id:`real:${day}:${items.length}`,day,start,end,kind,placeId:p.id,fromId:null,toId:null,transport:null,locked:false,mode:'real',...(label?{label}:{})});
 for(const p of selected){
  if(closedOn(p,date))continue;
  const route=last?indexCatalog(catalog).getRoute(last.id,p.id,basics.transport):null;
  if(last&&route?.duration.value==null)throw Error('장소 간 도로 시간을 조회하지 못했습니다. 다시 생성해 주세요.');
  const move=last?Math.ceil(route!.duration.value!):0;
  let begin=cursor+move;if(p.kind==='meal')begin=Math.max(begin,cursor<900?720:1080);const hours=p.opening?.value&&recentFact(p.opening)?p.opening.value:null;
  if(hours)begin=Math.max(begin,hours.open);
  // Unknown opening times are not treated as verified availability.
  const ceiling=Math.min(window.end,hours?.close??window.end),duration=visitDuration(p);
  if(begin+duration>ceiling)continue;
  if(last&&move>0){items.push({id:`real:${day}:${items.length}`,day,start:cursor,end:cursor+move,kind:'move',placeId:null,fromId:last.id,toId:p.id,transport:basics.transport,locked:false,mode:'real'});}
  if(begin>cursor+move)add(p,'rest',cursor+move,begin,'운영 시작 전 여유 시간');
  add(p,p.kind,begin,begin+duration,p.kind==='meal'?(begin<900?'점심 식사':'저녁 식사'):undefined);cursor=begin+duration;last=p;
  const rest=conditions.restMin??10;if(p.kind==='visit'&&cursor+rest<=window.end){add(p,'rest',cursor,cursor+rest,'휴식');cursor+=rest;}
 }
 if(!items.some(i=>i.kind==='visit'))throw Error('이동·체류·영업시간을 반영하면 방문 시간이 부족합니다. 시작을 앞당기거나 종료 시간을 늦춰 주세요.');
 return items;
}

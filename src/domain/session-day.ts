import {realisticDay} from './realistic-day';
import type {Basics,Conditions,Item} from './schema';
import type {Place} from '../data/demo';
import {indexCatalog,type Catalog} from '../data/catalog';
export function sessionDay(selected:Place[],basics:Basics,conditions:Conditions,catalog:Catalog,day:number):Item[]{
 if(!selected.length)return [];if(basics.roadCheckedAt&&basics.travelHours)return realisticDay(selected,basics,conditions,catalog,day);if(basics.travelHours)return customDay(selected,basics,conditions,catalog,day);const morning=basics.daySession==='morning';let cursor=morning?540:780;const end=morning?1110:1140;const rest=conditions.restMin??15;
 const moves=selected.map((p,i)=>i===0?0:Math.max(1,Math.ceil(indexCatalog(catalog).getRoute(selected[i-1].id,p.id,basics.transport)?.duration.value??20)));
 if(moves.some(n=>!Number.isFinite(n)))throw Error('이동 시간을 확인해 주세요.');
 const items:Item[]=[];let mealNumber=0;
 const add=(kind:Item['kind'],place:Place,length:number,label?:string)=>{if(length<=0)return;items.push({id:`session:${day}:${items.length}`,day,start:cursor,end:cursor+length,kind,placeId:place.id,fromId:null,toId:null,transport:null,locked:false,mode:'real',...(label?{label}:{})});cursor+=length;};
 for(let i=0;i<selected.length;i++){const place=selected[i];if(i){items.push({id:`session:${day}:${items.length}`,day,start:cursor,end:cursor+moves[i],kind:'move',placeId:null,fromId:selected[i-1].id,toId:place.id,transport:basics.transport,locked:false,mode:'real'});cursor+=moves[i];}
  if(place.kind==='meal'){const dinner=!morning||mealNumber>0;const earliest=dinner?1020:Math.min(720,conditions.latestLunch??720);if(cursor<earliest)add('rest',place,earliest-cursor,'자유 시간');add('meal',place,60,dinner?'저녁 식사':'점심 식사');mealNumber++;}
  else if(place.kind==='visit'){const remaining=selected.slice(i);const visits=remaining.filter(p=>p.kind==='visit').length;const fixed=moves.slice(i+1).reduce((a,b)=>a+b,0)+remaining.filter(p=>p.kind==='meal').length*60+remaining.filter(p=>p.kind==='rest').length*45+visits*rest;const duration=Math.min(180,Math.floor((end-cursor-fixed)/visits));if(duration<45)throw Error('이동·식사 시간을 포함하면 하루가 부족합니다. 가까운 장소로 바꿔 주세요.');add('visit',place,duration);add('rest',place,rest);}
  else add('rest',place,45);
  if(cursor>end)throw Error('이동·식사 시간을 포함하면 저녁 종료 시간을 넘습니다. 가까운 장소로 바꿔 주세요.');
 }
 if(cursor<end)add('rest',selected.at(-1)!,end-cursor,'자유 시간');return items;
}

function customDay(selected:Place[],basics:Basics,conditions:Conditions,catalog:Catalog,day:number):Item[]{
 const {start,end}=basics.travelHours!;let cursor=start;
 const route=indexCatalog(catalog);
 const moves=selected.map((p,i)=>i?Math.max(1,Math.ceil(route.getRoute(selected[i-1].id,p.id,basics.transport)?.duration.value??20)):0);
 const visits=selected.filter(p=>p.kind==='visit').length;
 const rest=conditions.restMin??10;
 const fixed=moves.reduce((a,b)=>a+b,0)+selected.filter(p=>p.kind==='meal').length*45+selected.filter(p=>p.kind==='rest').length*15;
 const visitTime=Math.min(180,Math.floor((end-start-fixed)/Math.max(1,visits)));
 if(moves.some(v=>!Number.isFinite(v))||visitTime<30)throw Error('이동·식사를 포함하기에 시간이 부족해요. 여행 시간을 늘리거나 가까운 장소로 바꿔 주세요.');
 const items:Item[]=[];
 function add(place:Place,kind:Item['kind'],length:number,label?:string){if(length<=0)return;items.push({id:`session:${day}:${items.length}`,day,start:cursor,end:cursor+length,kind,placeId:place.id,fromId:null,toId:null,transport:null,locked:false,mode:'real',...(label?{label}:{})});cursor+=length;}
 for(let i=0;i<selected.length;i++){
  const p=selected[i];if(i){items.push({id:`session:${day}:${items.length}`,day,start:cursor,end:cursor+moves[i],kind:'move',placeId:null,fromId:selected[i-1].id,toId:p.id,transport:basics.transport,locked:false,mode:'real'});cursor+=moves[i];}
  if(p.kind==='visit'){const pause=visitTime>=30+rest?rest:0;add(p,'visit',visitTime-pause);add(p,'rest',pause);}
  else if(p.kind==='meal')add(p,'meal',45,cursor<900?'점심 식사':'저녁 식사');else add(p,'rest',15);
 }
 if(cursor>end)throw Error('선택한 종료 시간을 넘습니다. 여행 시간을 늘려 주세요.');
 if(cursor<end)add(selected.at(-1)!,'rest',end-cursor,'자유 시간');return items;
}

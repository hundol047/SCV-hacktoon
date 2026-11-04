import type {Basics,Conditions,Item} from './schema';
import type {Place} from '../data/demo';
import {indexCatalog,type Catalog} from '../data/catalog';
export function sessionDay(selected:Place[],basics:Basics,conditions:Conditions,catalog:Catalog,day:number):Item[]{
 if(!selected.length)return [];const morning=basics.daySession==='morning';let cursor=morning?540:780;const end=morning?1110:1140;const rest=conditions.restMin??15;
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

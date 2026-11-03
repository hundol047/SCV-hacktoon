import type {Trip} from './schema';
import {dayDate} from './schema';
import {dayWeather} from './day-weather';
import {replacementInput,applyReplacement} from './replacements';
export function indoorAlternative(trip:Trip,day:number){
 if(dayWeather(trip.basics,day)==='storm')throw Error('악천후에는 실내 관광도 자동 추천하지 않습니다. 여행 연기와 공식 안내를 확인하세요.');
 let result=trip;const changes:{before:string;after:string}[]=[],unavailable:string[]=[];
 for(const item of trip.items.filter(i=>i.day===day&&i.kind==='visit')){
  const p=trip.catalog?.places.find(p=>p.id===item.placeId);if(!p||p.setting?.value==='indoor')continue;
  if(item.locked){unavailable.push(p.name+' · 고정된 일정');continue;}
  try{
   const candidates=replacementInput(result,item.id).candidates;
   const next=candidates.find(p=>p.setting?.value==='indoor');
   if(!next){unavailable.push(p.name+' · 조건에 맞는 실내 후보 없음');continue;}
   result=applyReplacement(result,item.id,next.id);changes.push({before:p.name,after:next.name});
  }catch(e){unavailable.push(p.name+' · '+(e instanceof Error?e.message:'대체 불가'));}
 }
 // One user action = one undo step, regardless of the number of replacements.
 result={...result,revision:trip.revision+1,history:[...trip.history,structuredClone(trip.items)].slice(-20),historyBasics:[...trip.history.map((_,i)=>trip.historyBasics?.[i]??null),structuredClone(trip.basics)].slice(-20)};
 return {trip:result,changes,unavailable,date:dayDate(trip.basics,day)};
}

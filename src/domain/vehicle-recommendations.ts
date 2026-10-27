import type {Place} from '../data/demo';
import type {Basics,Conditions} from './schema';
import {haversineKm} from './taxi-plan';

export function vehiclePriority(b:Basics){return b.travelPriority??(b.transport==='driving'?'comfort':'budget');}
export function rankVehiclePlaces(places:Place[],b:Basics,c:Conditions,origin?:Place){
  const priority=vehiclePriority(b);
  return places.filter(p=>!(c.avoidStairs&&p.stairs.value===true)&&!(c.maxWalkMin!==null&&p.walkMin.value!==null&&p.walkMin.value>c.maxWalkMin)&&!(c.maxWalkM!==null&&p.walkM.value!==null&&p.walkM.value>c.maxWalkM)&&!c.avoidSituations.some(s=>p.situations.value?.includes(s))&&!c.foodAvoids.some(f=>p.foods.value?.includes(f))).map(place=>{
    const distance=origin?haversineKm(origin,place):null;
    const comfort=Number(place.seat.value===true)*2+Number(place.stairs.value===false);
    const experience=c.experiences.filter(e=>place.experiences.includes(e)).length;
    const reasons:string[]=[];
    if(distance!==null)reasons.push(`기준 장소에서 직선 ${distance.toFixed(2)}km`);
    if(place.seat.value===true)reasons.push('좌석 있음으로 기록');
    if(place.stairs.value===false)reasons.push('계단 없음으로 기록');
    if(place.walkMin.value!==null)reasons.push(`내부 보행 ${place.walkMin.value}분으로 기록`);
    return {place,distance,comfort,experience,reasons};
  }).sort((a,d)=>{
    const nearby=(a.distance??Infinity)-(d.distance??Infinity)||0;
    const comfort=d.comfort-a.comfort||(a.place.walkMin.value??Infinity)-(d.place.walkMin.value??Infinity)||0;
    const experience=d.experience-a.experience;
    return (priority==='budget'?nearby||experience||comfort:priority==='comfort'?comfort||experience||nearby:experience||nearby||comfort)||a.place.name.localeCompare(d.place.name,'ko');
  });
}

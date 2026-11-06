import {z} from 'zod';
import {tripSchema,basicsSchema} from '../../../domain/schema';
import {sameOrigin,json,readJSON} from '../../../server/security';
import {planningQuota} from '../../../server/planning-quota';
import {prepareTrip} from '../../../server/prepare-trip';
import {savedPlans} from '../../../domain/course-plans';
import {haversineKm} from '../../../domain/taxi-plan';
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'잘못된 요청입니다.'},403);try{await planningQuota(request);const {trip,basics,mode}=z.object({trip:tripSchema,basics:basicsSchema.optional(),mode:z.enum(['settings','budget','distance','relaxed']).default('settings')}).parse(await readJSON(request));if(!trip.catalog||trip.basics.days>5)throw Error('최대 5일의 차량 일정을 선택하세요.');if(trip.items.some(i=>i.locked))throw Error('확정·완료한 일정이 있습니다. 남은 일정 재추천을 이용하세요.');
 const b={...(basics??trip.basics)},conditions={...trip.conditions};
 if(mode!=='settings'){b.coursePlans=savedPlans(b).map(plan=>{let ids=[...plan.orderedPlaceIds];const place=(id:string)=>trip.catalog!.places.find(p=>p.id===id)!;
 if(mode==='budget'){const visits=ids.filter(id=>place(id)?.kind==='visit');const expensive=visits.filter(id=>(place(id).cost.value??b.pricing?.rates.admission??10000)>0).sort((a,d)=>(place(d).cost.value??10000)-(place(a).cost.value??10000));if(visits.length>1&&expensive[0])ids=ids.filter(id=>id!==expensive[0]);}
 if(mode==='relaxed'){const visits=ids.filter(id=>place(id)?.kind==='visit');if(visits.length>1)ids=ids.filter(id=>id!==visits.at(-1));conditions.restMin=Math.max(20,conditions.restMin??0);}
 if(mode==='distance'){const ordered=[ids.shift()!];while(ids.length){ids.sort((a,d)=>(haversineKm(place(ordered.at(-1)!),place(a))??Infinity)-(haversineKm(place(ordered.at(-1)!),place(d))??Infinity));ordered.push(ids.shift()!);}ids=ordered;}
 return {...plan,selectedPlaceIds:ids,orderedPlaceIds:ids,startPlaceId:ids[0]};});b.taxiPlan=b.coursePlans.at(-1);}
 const next=await prepareTrip(b,conditions,trip.catalog);return json({trip:tripSchema.parse({...trip,history:[...trip.history,trip.items].slice(-20),historyBasics:[...(trip.historyBasics??[]),trip.basics].slice(-20),basics:next.basics,catalog:next.catalog,conditions:next.conditions,items:next.items,revision:trip.revision+1})});
 }catch(e){return json({error:e instanceof Error?e.message:'일정 변경을 완료하지 못했습니다.'},422);}}

import type {Trip} from './schema';
import {courseInput,regionalCourse} from './regional-course';
import {savedPlans} from './course-plans';
export type CourseOption={ids:string[];names:string[];signature:string};
export const courseSignature=(ids:string[])=>[...new Set(ids)].sort().join('|');
export function dailyCourseOptions(trip:Trip,day:number):CourseOption[]{
 const catalog=trip.catalog;if(!catalog)return [];
 const current=savedPlans(trip.basics).find(p=>(p.day??1)===day);
 if(!current)return [];
 const options:CourseOption[]=[];
 const add=(ids:string[])=>{const visits=ids.filter(id=>catalog.places.find(p=>p.id===id)?.kind==='visit');const signature=courseSignature(visits);if(!visits.length||options.some(o=>o.signature===signature))return;options.push({ids,names:ids.map(id=>catalog.places.find(p=>p.id===id)?.name??''),signature});};
 add(current.orderedPlaceIds);
 try{
  const input=courseInput(trip.basics,trip.conditions,catalog,day);
  const candidates=input.candidates.map(c=>c.place.id);
  const count=Math.max(input.minAttractions,Math.min(input.maxAttractions,current.orderedPlaceIds.filter(id=>catalog.places.find(p=>p.id===id)?.kind==='visit').length));
  // Prefer unused attractions, then permit partial overlap when the local pool is small.
  for(let attempt=0;attempt<candidates.length&&options.length<3;attempt++){
   const used=new Map<string,number>();for(const option of options)for(const id of option.ids)used.set(id,(used.get(id)??0)+1);
   const rotated=[...candidates.slice(attempt),...candidates.slice(0,attempt)].sort((a,b)=>(used.get(a)??0)-(used.get(b)??0));
   try{add(regionalCourse(trip.basics,trip.conditions,catalog,day,{candidateIds:rotated.slice(0,Math.max(input.minAttractions,Math.min(count,candidates.length-1)))},{fillDay:true}).plan.orderedPlaceIds);}catch{/* Keep only valid candidates, never relax requested accessibility. */}
  }
 }catch{/* A saved course remains available even if no alternatives meet the conditions. */}
 return options;
}

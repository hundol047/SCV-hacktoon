import type {Catalog} from '../data/catalog';
import type {Trip} from './schema';
import {courseInput,regionalCourse} from './regional-course';
import {savedPlans} from './course-plans';
export type CourseOption={ids:string[];names:string[];signature:string};
export function coursePlaceKey(id:string,catalog?:Catalog){const place=catalog?.places.find(p=>p.id===id);return place?place.kind+':'+place.name.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}]/gu,''):id;}
export const courseSignature=(ids:string[],catalog?:Catalog)=>[...new Set(ids.map(id=>coursePlaceKey(id,catalog)))].sort().join('|');
export function genuinelyDifferentCourses(a:string[],b:string[],catalog:Catalog){
 const keys=(ids:string[])=>new Set(ids.filter(id=>catalog.places.find(p=>p.id===id)?.kind==='visit').map(id=>coursePlaceKey(id,catalog)));
 const left=keys(a),right=keys(b);
 // Neither permutations, provider aliases, nor a strict superset make a separate course.
 return [...left].some(key=>!right.has(key))&&[...right].some(key=>!left.has(key));
}
export function dailyCourseOptions(trip:Trip,day:number):CourseOption[]{
 const catalog=trip.catalog;if(!catalog)return [];
 const current=savedPlans(trip.basics).find(p=>(p.day??1)===day);
 if(!current)return [];
 const options:CourseOption[]=[];
 const otherKeys=new Set(savedPlans(trip.basics).filter(p=>(p.day??1)!==day).flatMap(p=>p.selectedPlaceIds).map(id=>coursePlaceKey(id,catalog)));
 const reservedAliases=new Set(catalog.places.filter(p=>otherKeys.has(coursePlaceKey(p.id,catalog))).map(p=>p.id));
 const add=(sourceIds:string[])=>{const seen=new Set<string>();const ids=sourceIds.filter(id=>{const key=coursePlaceKey(id,catalog);if(seen.has(key))return false;seen.add(key);return true;});const visits=ids.filter(id=>catalog.places.find(p=>p.id===id)?.kind==='visit');const signature=courseSignature(visits,catalog);if(!visits.length||options.some(o=>!genuinelyDifferentCourses(o.ids,ids,catalog))||options.length>0&&visits.some(id=>reservedAliases.has(id)))return;options.push({ids,names:ids.map(id=>catalog.places.find(p=>p.id===id)?.name??''),signature});};
 add(current.orderedPlaceIds);
 try{
  const input=courseInput(trip.basics,trip.conditions,catalog,day,200);
  const candidates=input.candidates.map(c=>c.place.id).filter(id=>!reservedAliases.has(id));
  const count=Math.max(input.minAttractions,Math.min(input.maxAttractions,current.orderedPlaceIds.filter(id=>catalog.places.find(p=>p.id===id)?.kind==='visit').length));
  // Prefer unused attractions, then permit partial overlap when the local pool is small.
  for(let attempt=0;attempt<candidates.length&&options.length<3;attempt++){
   const used=new Map<string,number>();for(const option of options)for(const id of option.ids)used.set(id,(used.get(id)??0)+1);
   const rotated=[...candidates.slice(attempt),...candidates.slice(0,attempt)].sort((a,b)=>(used.get(a)??0)-(used.get(b)??0));
   try{add(regionalCourse(trip.basics,trip.conditions,catalog,day,{candidateIds:rotated.slice(0,Math.max(input.minAttractions,Math.min(count,candidates.length-1)))},{fillDay:true,candidateLimit:200,reservedIds:reservedAliases}).plan.orderedPlaceIds);}catch{/* Keep only valid candidates, never relax requested accessibility. */}
  }
  // Replacing one stop avoids fillDay repeatedly rebuilding the same full set.
  const currentVisits=current.orderedPlaceIds.filter(id=>catalog.places.find(p=>p.id===id)?.kind==='visit');
  for(const removed of currentVisits){if(options.length>=3)break;for(const replacement of candidates){if(options.length>=3)break;if(currentVisits.includes(replacement))continue;const ids=currentVisits.map(id=>id===removed?replacement:id);try{const result=regionalCourse(trip.basics,trip.conditions,catalog,day,{candidateIds:ids},{fillDay:true,candidateLimit:200,reservedIds:new Set([...reservedAliases,...catalog.places.filter(p=>coursePlaceKey(p.id,catalog)===coursePlaceKey(removed,catalog)).map(p=>p.id)])});if(result.plan.orderedPlaceIds.filter(id=>catalog.places.find(p=>p.id===id)?.kind==='visit').length>=currentVisits.length)add(result.plan.orderedPlaceIds);}catch{}}}
 }catch{/* A saved course remains available even if no alternatives meet the conditions. */}
 return options;
}

export function courseAvailability(trip:Trip,day:number){
 if(!trip.catalog)return '장소 자료를 다시 불러와 주세요.';
 try{const input=courseInput(trip.basics,trip.conditions,trip.catalog,day,200);const used=new Set(savedPlans(trip.basics).filter(p=>(p.day??1)!==day).flatMap(p=>p.selectedPlaceIds));return `이 날짜의 조건에 맞는 관광지 ${input.candidates.length}곳 · 다른 날짜에 사용한 장소 ${used.size}곳 제외. 같은 관광지 조합은 중복 추천하지 않습니다.`;}catch(e){return e instanceof Error?e.message:'조건에 맞는 관광지가 부족합니다.';}
}

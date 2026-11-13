import type {Place} from '../data/demo';
import type {Catalog} from '../data/catalog';
import {indexCatalog} from '../data/catalog';
import type {Basics,Conditions,Item} from './schema';
import {realisticDay} from './realistic-day';
// Bounded beam search on actual road minutes. Feasibility is checked by the scheduler.
export function arrangeCustomCourse(places:Place[],basics:Basics,conditions:Conditions,catalog:Catalog,day:number,origin?:Place,target?:Place):Item[]{
 const route=(a:Place,b:Place)=>a.id===b.id?0:indexCatalog(catalog).getRoute(a.id,b.id,basics.transport)?.duration.value??Infinity;
 let paths:{ids:number[];cost:number}[]=[{ids:[],cost:0}];
 for(let depth=0;depth<places.length;depth++){
  paths=paths.flatMap(path=>places.flatMap((place,i)=>path.ids.includes(i)?[]:[{ids:[...path.ids,i],cost:path.cost+(path.ids.length?route(places[path.ids.at(-1)!],place):origin?route(origin,place):0)}])).filter(p=>Number.isFinite(p.cost)).sort((a,b)=>a.cost-b.cost).slice(0,64);
 }
 const orders=[places,...paths.map(path=>path.ids.map(i=>places[i]))];let best:Item[]|undefined,bestCost=Infinity;
 for(const order of orders){try{const rows=realisticDay(order,basics,conditions,catalog,day);const retained=new Set(rows.filter(i=>i.kind==='visit'||i.kind==='meal').map(i=>i.placeId));if(places.some(p=>!retained.has(p.id)))continue;const score=rows.filter(i=>i.kind==='move').reduce((sum,i)=>sum+i.end-i.start,0)+(origin?route(origin,order[0]):0)+(target?route(order.at(-1)!,target):0);if(score<bestCost){best=rows;bestCost=score;}}catch{/* Try another order without relaxing constraints. */}}
 if(!best)throw Error('담은 장소를 모두 방문할 수 있는 배치를 찾지 못했어요. 장소 수를 줄이거나 여행 시간·운영시간을 확인해 주세요.');return best;
}

import { z } from 'zod';
import { places as demoPlaces, routes as demoRoutes, type Place, type Route } from './demo';

const fact = <T extends z.ZodType>(value:T) => z.object({value:value.nullable(),evidenceId:z.string().min(1),source:z.string().min(1),nature:z.enum(['demo','real']),checked:z.enum(['simulated','source','unknown']),collectedAt:z.string().datetime().nullable().optional()});
export const placeSchema=z.object({id:z.string().min(1),name:z.string().min(1),kind:z.enum(['visit','meal','rest']),experiences:z.array(z.string()),description:z.string(),walkMin:fact(z.number().nonnegative()),walkM:fact(z.number().nonnegative()),stairs:fact(z.boolean()),seat:fact(z.boolean()),foods:fact(z.array(z.string())),cost:fact(z.number().nonnegative()),hours:fact(z.tuple([z.number().min(0).max(1440),z.number().min(0).max(1440)])),situations:fact(z.array(z.string())),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional()});
export const routeSchema=z.object({id:z.string(),fromId:z.string(),toId:z.string(),transport:z.enum(['walk','taxi']),duration:fact(z.number().nonnegative()),walkMin:fact(z.number().nonnegative()),walkM:fact(z.number().nonnegative()),cost:fact(z.number().nonnegative()),stairs:fact(z.boolean()),mode:z.enum(['demo','real'])});
export const catalogSchema=z.object({mode:z.enum(['demo','real']),region:z.string().min(1).max(120),places:z.array(placeSchema).max(200),routes:z.array(routeSchema).max(10000),sourceNotice:z.string(),collectedAt:z.string().datetime().nullable()}).superRefine((c,ctx)=>{
  const ids=new Set(c.places.map(p=>p.id));
  if(ids.size!==c.places.length)ctx.addIssue({code:'custom',message:'장소 ID가 중복됩니다.'});
  if(new Set(c.routes.map(r=>r.id)).size!==c.routes.length)ctx.addIssue({code:'custom',message:'경로 ID가 중복됩니다.'});
  if((c.mode==='demo')!==(c.region==='가상 솔바다'))ctx.addIssue({code:'custom',message:'지역과 데이터 모드가 일치하지 않습니다.'});
  for(const p of c.places)for(const f of [p.walkMin,p.walkM,p.stairs,p.seat,p.foods,p.cost,p.hours,p.situations]){
    if(f.nature!==c.mode)ctx.addIssue({code:'custom',message:'실제·가상 장소 정보를 섞을 수 없습니다.'});
    if(c.mode==='real'&&f.value!==null&&(f.checked!=='source'||!f.collectedAt||!/^https:\/\//.test(f.source)))ctx.addIssue({code:'custom',message:'실제 값은 HTTPS 출처와 수집 시각이 필요합니다.'});
  }
  for(const r of c.routes){if(r.mode!==c.mode||!ids.has(r.fromId)||!ids.has(r.toId))ctx.addIssue({code:'custom',message:'경로 집합이 장소·모드와 맞지 않습니다.'});
    for(const f of [r.duration,r.walkMin,r.walkM,r.cost,r.stairs])if(f.nature!==c.mode||c.mode==='real'&&f.value!==null&&(f.checked!=='source'||!f.collectedAt||!/^https:\/\//.test(f.source)))ctx.addIssue({code:'custom',message:'경로의 실제 출처가 필요합니다.'});}
});
export type Catalog=z.infer<typeof catalogSchema>;
export const demoCatalog:Catalog={mode:'demo',region:'가상 솔바다',places:demoPlaces,routes:demoRoutes,sourceNotice:'가상 시연 데이터 · 실제 여행에 사용하지 마세요',collectedAt:null};
export const emptyRealCatalog:Catalog={mode:'real',region:'실제 지역',places:[],routes:[],sourceNotice:'실제 자료 · 시설·메뉴·경로의 미확인 항목은 별도 확인이 필요합니다.',collectedAt:null};
export function catalogFor(mode:'demo'|'real',catalog?:Catalog){if(catalog?.mode===mode)return catalog;return mode==='demo'?demoCatalog:emptyRealCatalog;}
type Index={placeById:Map<string,Place>;getRoute:(from:string|null,to:string|null,t:'taxi'|'walk'|null)=>Route|undefined};
const indexes=new WeakMap<Catalog,Index>();
export function indexCatalog(catalog:Catalog){const cached=indexes.get(catalog);if(cached)return cached;const placeById=new Map<string,Place>(catalog.places.map(p=>[p.id,p]));const routeById=new Map<string,Route>(catalog.routes.map(r=>[r.id,r]));const index={placeById,getRoute:(from:string|null,to:string|null,t:'taxi'|'walk'|null)=>routeById.get(`r:${from}:${to}:${t}`)};indexes.set(catalog,index);return index;}

import {z} from 'zod';
import {Catalog,catalogSchema} from '../data/catalog';
import {Fact,Place,Route} from '../data/demo';
export const locationSchema=z.object({lat:z.coerce.number().min(-90).max(90),lon:z.coerce.number().min(-180).max(180),display_name:z.string().max(1000)});
const elementSchema=z.object({type:z.enum(['node','way','relation']),id:z.number().int().positive(),lat:z.number().optional(),lon:z.number().optional(),center:z.object({lat:z.number(),lon:z.number()}).optional(),tags:z.record(z.string(),z.string()).default({})});
export function osmCatalog(query:string,data:unknown,collectedAt:string):Catalog{
  const parsed=z.object({elements:z.array(elementSchema).max(10000)}).parse(data);
  const groups:{visit:Place[];meal:Place[];rest:Place[]}={visit:[],meal:[],rest:[]};
  const limits={visit:15,meal:8,rest:7};
  for(const e of parsed.elements){const tags=e.tags,name=tags['name:ko']??tags.name;if(!name)continue;
    const kind=tags.amenity==='restaurant'?'meal':tags.amenity==='cafe'||tags.amenity==='bench'?'rest':'visit';if(groups[kind].length>=limits[kind])continue;
    const id=`osm:${e.type}:${e.id}`,source=`https://www.openstreetmap.org/${e.type}/${e.id}`;
    const fact=<T>(field:string,value:T|null):Fact<T>=>({value,evidenceId:`${id}:${field}`,source,nature:'real',checked:value===null?'unknown':'source',collectedAt});
    const lat=e.lat??e.center?.lat,lon=e.lon??e.center?.lon;
    // Wheelchair=yes, a restaurant category or map coordinates do not prove zero stairs/walking or seating.
    groups[kind].push({id,name:name.slice(0,120),kind,experiences:tags.tourism==='museum'?['문화·전시']:tags.leisure==='park'||tags.natural==='beach'?['자연 풍경']:[],description:'OpenStreetMap 기여자가 등록한 실제 장소입니다. 현지 운영·접근성 정보는 별도로 확인해 주세요.',
      walkMin:fact<number>('walkMin',null),walkM:fact<number>('walkM',null),stairs:fact('stairs',tags.highway==='steps'?true:tags.step_count==='0'?false:null),
      seat:fact('seat',/^\d+$/.test(tags.seats??'')&&Number(tags.seats)>0?true:tags.bench==='yes'?true:null),
      foods:fact<string[]>('foods',null),cost:fact<number>('cost',null),hours:fact<[number,number]>('hours',null),situations:fact<string[]>('situations',null),latitude:lat,longitude:lon});
  }
  return catalogSchema.parse({mode:'real',region:query,places:[...groups.visit,...groups.meal,...groups.rest],routes:[],collectedAt,sourceNotice:'실제 장소 자료 · © OpenStreetMap 기여자 / ODbL · 중심 반경 10km 검색. 시설·내부 보행·메뉴·비용은 미확인입니다.'});
}
export class OpenMapProvider{
  constructor(private appURL:string,private fetcher:typeof fetch=fetch){}
  async location(query:string){const url=new URL('https://nominatim.openstreetmap.org/search');url.search=new URLSearchParams({q:query,format:'jsonv2',limit:'1','accept-language':'ko,en'}).toString();const res=await this.fetcher(url,{headers:{'User-Agent':`Bopok/0.2 (+${this.appURL})`},signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('지역 검색 공급자 오류');const result=z.array(locationSchema).parse(await res.json());if(!result.length)throw Error('지역을 찾지 못했습니다. 도시와 국가를 함께 입력해 주세요.');return result[0];}
  async places(query:string,location:z.infer<typeof locationSchema>){const {lat,lon}=locationSchema.parse(location);const filter=`[out:json][timeout:20];(nwr(around:10000,${lat},${lon})["tourism"~"attraction|museum|viewpoint"];nwr(around:10000,${lat},${lon})["natural"="beach"];nwr(around:10000,${lat},${lon})["leisure"="park"];nwr(around:10000,${lat},${lon})["amenity"~"restaurant|cafe|bench"];);out center tags 500;`;const res=await this.fetcher('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':`Bopok/0.2 (+${this.appURL})`},body:new URLSearchParams({data:filter}),signal:AbortSignal.timeout(25000)});if(!res.ok)throw Error('장소 자료 공급자 오류');return osmCatalog(query,await res.json(),new Date().toISOString());}
}
export class OpenRouteProvider{
  constructor(private key:string,private fetcher:typeof fetch=fetch){}
  async route(from:Place,to:Place,transport:'walk'|'taxi'):Promise<Route>{if([from.longitude,from.latitude,to.longitude,to.latitude].some(v=>v===undefined))throw Error('좌표 미확인');
    const profile=transport==='walk'?'foot-walking':'driving-car',url=`https://api.openrouteservice.org/v2/directions/${profile}/json`;
    const res=await this.fetcher(url,{method:'POST',headers:{Authorization:this.key,'Content-Type':'application/json'},body:JSON.stringify({coordinates:[[from.longitude,from.latitude],[to.longitude,to.latitude]],instructions:false,geometry:false}),signal:AbortSignal.timeout(12000)});
    if(!res.ok)throw Error('경로 조회 실패');const summary=z.object({routes:z.array(z.object({summary:z.object({distance:z.number().nonnegative(),duration:z.number().positive()})})).min(1)}).parse(await res.json()).routes[0].summary;
    const id=`r:${from.id}:${to.id}:${transport}`,collectedAt=new Date().toISOString();const fact=<T>(field:string,value:T|null):Fact<T>=>({value,evidenceId:`${id}:${field}`,source:url,nature:'real',checked:value===null?'unknown':'source',collectedAt});
    return {id,fromId:from.id,toId:to.id,transport,mode:'real',duration:fact('duration',Math.ceil(summary.duration/60)),walkMin:fact<number>('walkMin',transport==='walk'?Math.ceil(summary.duration/60):null),walkM:fact<number>('walkM',transport==='walk'?Math.ceil(summary.distance):null),stairs:fact<boolean>('stairs',null),cost:fact<number>('cost',null)};
  }
}

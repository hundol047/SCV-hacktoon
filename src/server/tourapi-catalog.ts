import {winterLeisure} from '../data/national-discovery';
import {catalogSchema,type Catalog} from '../data/catalog';
import type {Place,Fact} from '../data/demo';
const areas:Record<string,string>={'KR-11':'1','KR-28':'2','KR-30':'3','KR-27':'4','KR-29':'5','KR-26':'6','KR-31':'7','KR-50':'8','KR-41':'31','KR-42':'32','KR-43':'33','KR-44':'34','KR-47':'35','KR-48':'36','KR-45':'37','KR-46':'38','KR-49':'39'};
const clean=(s:string)=>s.trim().replace(/[시군구]$/,'');
export function createOfficialCatalog(fetcher:typeof fetch=fetch){
 let quotaDay='',requests=0;
 const cache=new Map<string,{at:number;catalog:Catalog}>();
 return async(base:Catalog,province:string,query:string,key=process.env.BOPok_TOURAPI_KEY??''):Promise<Catalog>=>{
  if(!key||!areas[province])return base;const cacheKey=province+':'+query;const cached=cache.get(cacheKey);if(cached&&Date.now()-cached.at<6*3600000)return merge(base,cached.catalog);
  const deadline=AbortSignal.timeout(8000);
  async function get(op:string,params:Record<string,string>){const today=new Date().toISOString().slice(0,10);if(quotaDay!==today){quotaDay=today;requests=0;}if(requests>=2000)throw Error();requests++;const url='https://apis.data.go.kr/B551011/KorService2/'+op+'?'+new URLSearchParams({serviceKey:key,MobileOS:'ETC',MobileApp:'Yeohaengit',_type:'json',numOfRows:'100',pageNo:'1',...params});const r=await fetcher(url,{signal:deadline,redirect:'error'});if(!r.ok)throw Error();const text=await r.text();if(text.length>2000000)throw Error();const d=JSON.parse(text)?.response;if(!['00','0000'].includes(String(d?.header?.resultCode)))throw Error();const rows=d?.body?.items?.item;return (Array.isArray(rows)?rows:rows&&typeof rows==='object'?[rows]:[]) as Record<string,string>[];}
  try{
   let sigunguCode='';if(query.trim()){const districts=await get('areaCode2',{areaCode:areas[province]});const district=districts.filter(r=>clean(String(r.name))===clean(query));if(district.length!==1)return base;sigunguCode=String(district[0].code);}
   const groups=await Promise.all(['12','14','28','39'].map(contentTypeId=>get('areaBasedList2',{areaCode:areas[province],...(sigunguCode?{sigunguCode}:{}),contentTypeId,arrange:'A'})));
   const at=new Date().toISOString();const places:Place[]=[];
   for(const r of groups.flat()){const lat=Number(r.mapy),lon=Number(r.mapx);if(!/^\d+$/.test(String(r.contentid))||!String(r.title??'').trim()||lat<33||lat>39||lon<124||lon>132||!Number.isFinite(lat)||!Number.isFinite(lon))continue;
    const id='tourapi:'+r.contentid;
    const fact=<T>(field:string,value:T|null):Fact<T>=>({value,evidenceId:id+':'+field,source:'https://apis.data.go.kr/B551011/KorService2/areaBasedList2',nature:'real',checked:value===null?'unknown':'source',collectedAt:at});
    places.push({id,name:r.title.slice(0,300),region:base.region,latitude:lat,longitude:lon,currency:'KRW',kind:String(r.contenttypeid)==='39'?'meal':'visit',experiences:winterLeisure(String(r.title))?['겨울 레저']:String(r.contenttypeid)==='14'?['문화·전시']:[],description:'한국관광공사 관광정보',visitorInfo:{address:[r.addr1,r.addr2].filter(Boolean).join(' ').slice(0,1000),phone:String(r.tel??'').slice(0,3000)},walkMin:fact<number>('walkMin',null),walkM:fact<number>('walkM',null),stairs:fact<boolean>('stairs',null),seat:fact<boolean>('seat',null),foods:fact<string[]>('foods',null),cost:fact<number>('cost',null),hours:fact<[number,number]>('hours',null),situations:fact<string[]>('situations',null)});
   }
   const catalog=catalogSchema.parse({...base,places:[...new Map(places.map(p=>[p.id,p])).values()],sourceNotice:'한국관광공사 국문 관광정보',collectedAt:at});if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(cacheKey,{at:Date.now(),catalog});return merge(base,catalog);
  }catch{return base;}
 };
}
function merge(base:Catalog,official:Catalog):Catalog{const names=new Set(official.places.map(p=>p.name.replace(/\s/g,'')));const visits=official.places.filter(p=>p.kind==='visit'),meals=official.places.filter(p=>p.kind==='meal');return {...base,places:[...visits.slice(0,140),...meals.slice(0,40),...base.places.filter(p=>!names.has(p.name.replace(/\s/g,'')))].slice(0,200),sourceNotice:base.sourceNotice+' · 한국관광공사 국문 관광정보'};}
export const officialCatalog=createOfficialCatalog();

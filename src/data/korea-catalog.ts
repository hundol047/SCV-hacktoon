import {koreaCategories,koreaRegions,type KoreaSnapshot,type KoreaRecord} from './korea-tourism';
import {catalogSchema,type Catalog} from './catalog';
import type {Place,Fact} from './demo';
const searchable=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g,' ').trim();
export function searchKorea(snapshot:KoreaSnapshot,query='',province='',category='',page=1,limit=25){
 const words=searchable(query).split(' ').filter(Boolean);
 const records=snapshot.records.filter(r=>(!province||r.provinces.includes(province as typeof koreaRegions[number]['code']))&&(!category||r.category===category)&&words.every(w=>searchable([r.name,r.address,...r.provinces.map(c=>koreaRegions.find(p=>p.code===c)?.name??''),...Object.values(r.tags).filter(Boolean)].join(' ')).includes(w)));
 return {total:records.length,page,limit,records:records.slice((page-1)*limit,page*limit)};
}
export function koreaPlace(record:KoreaRecord,snapshot:KoreaSnapshot,region:string):Place {
 const source='https://www.openstreetmap.org/'+record.id.replace('osm:','').replace(':','/');
 const collectedAt=snapshot.coverage.filter(c=>record.provinces.includes(c.code)).map(c=>c.collectedAt).sort()[0];
 const fact=<T>(field:string,value:T|null):Fact<T>=>({value,evidenceId:record.id+':'+field,source,nature:'real',checked:value===null?'unknown':'source',collectedAt});
 return {id:record.id,name:record.name,kind:record.category==='food'?'meal':['cafe','rest'].includes(record.category)?'rest':'visit',
  experiences:record.category==='culture'||record.category==='heritage'?['문화·전시']:record.category==='nature'?['자연 풍경']:[],
  description:`${koreaCategories[record.category]} · ${record.address||'상세 주소 미등록'} · 전국 OSM 수집 자료. 운영·시설·메뉴는 별도 확인이 필요합니다.`,
  walkMin:fact<number>('walkMin',null),walkM:fact<number>('walkM',null),stairs:fact<boolean>('stairs',record.tags.highway==='steps'?true:record.tags.step_count==='0'?false:null),
  seat:fact<boolean>('seat',/^\d+$/.test(record.tags.seats??'')&&Number(record.tags.seats)>0||record.tags.bench==='yes'?true:null),
  foods:fact<string[]>('foods',null),cost:fact<number>('cost',null),hours:fact<[number,number]>('hours',null),situations:fact<string[]>('situations',null),
  latitude:record.latitude??undefined,longitude:record.longitude??undefined,region,currency:'KRW'};
}
export function koreaCatalog(snapshot:KoreaSnapshot,province:string,query='',limit=200):Catalog {
 const name=koreaRegions.find(r=>r.code===province)?.name;if(!name)throw Error('한 시·도를 선택해 주세요.');
 const region=name,matches=searchKorea(snapshot,query,province,'',1,snapshot.records.length).records;
 // Lodging/shopping/leisure remain searchable; they must not silently become sightseeing/rest stops.
 const eligible=matches.filter(r=>r.nameKnown&&r.latitude!==null&&r.longitude!==null&&!['lodging','shopping','leisure'].includes(r.category));
 const groups=[eligible.filter(r=>r.category==='food'),eligible.filter(r=>['cafe','rest'].includes(r.category)),eligible.filter(r=>!['food','cafe','rest'].includes(r.category))];
 const selected:KoreaRecord[]=[];
 // Interleave types so a sort by OSM ID cannot hide all meals or breaks.
 for(let n=0;selected.length<limit&&groups.some(g=>g[n]);n++)for(const group of groups)if(group[n]&&selected.length<limit)selected.push(group[n]);
 const latitude=selected.length?selected.reduce((sum,r)=>sum+r.latitude!,0)/selected.length:36;
 const longitude=selected.length?selected.reduce((sum,r)=>sum+r.longitude!,0)/selected.length:127;
 return catalogSchema.parse({mode:'real',region,places:selected.map(r=>koreaPlace(r,snapshot,region)),routes:[],
  cities:[{region,latitude,longitude,timezone:'Asia/Seoul',countryCode:'KR',currency:'KRW',limit}],collectedAt:snapshot.coverage.find(c=>c.code===province)!.collectedAt,
  sourceNotice:`전국 OSM 수집 자료 · © OpenStreetMap 기여자 / ODbL · ${query.trim()?`검색어 «${query.trim()}» · `:''}이 지역 검색 ${matches.length}건 중 일정 후보 ${selected.length}건. 이름·좌표가 있는 관광·문화·역사·공원·음식점·카페·쉼터를 사용합니다. 숙박·쇼핑·레저는 별도 검색 목록입니다. 실제 시설·영업·보행·메뉴는 미확인입니다.`});
}

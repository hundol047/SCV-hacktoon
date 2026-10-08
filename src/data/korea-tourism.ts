import {z} from 'zod';

export const koreaRegions=[
 {code:'KR-11',name:'서울특별시'}, {code:'KR-26',name:'부산광역시'},
 {code:'KR-27',name:'대구광역시'}, {code:'KR-28',name:'인천광역시'},
 {code:'KR-29',name:'광주광역시'}, {code:'KR-30',name:'대전광역시'},
 {code:'KR-31',name:'울산광역시'}, {code:'KR-50',name:'세종특별자치시'},
 {code:'KR-41',name:'경기도'}, {code:'KR-42',name:'강원특별자치도'},
 {code:'KR-43',name:'충청북도'}, {code:'KR-44',name:'충청남도'},
 {code:'KR-45',name:'전북특별자치도'}, {code:'KR-46',name:'전라남도'},
 {code:'KR-47',name:'경상북도'}, {code:'KR-48',name:'경상남도'},
 {code:'KR-49',name:'제주특별자치도'},
] as const;
export const koreaCategories={attraction:'관광지',culture:'문화시설',heritage:'역사·문화유산',nature:'공원·자연',food:'음식점',cafe:'카페',lodging:'숙박',shopping:'쇼핑',leisure:'레저',rest:'쉼터'} as const;
export type KoreaCategory=keyof typeof koreaCategories;
const regionCode=z.enum(koreaRegions.map(r=>r.code));
export const koreaRecordSchema=z.object({
 id:z.string().regex(/^osm:(node|way|relation):[1-9]\d*$/),
 name:z.string().min(1).max(300),nameKnown:z.boolean(),
 category:z.enum(Object.keys(koreaCategories) as [KoreaCategory,...KoreaCategory[]]),
 provinces:z.array(regionCode).min(1).max(17),
 latitude:z.number().min(30).max(40).nullable(),longitude:z.number().min(123).max(133).nullable(),
 address:z.string().max(1000),tags:z.record(z.string().max(100),z.string().max(3000)),
});
export type KoreaRecord=z.infer<typeof koreaRecordSchema>;
export const koreaSnapshotSchema=z.object({
 version:z.literal(1),queryVersion:z.literal(1),collectedAt:z.string().datetime(),
 license:z.literal('ODbL-1.0'),attribution:z.literal('© OpenStreetMap contributors'),
 source:z.literal('https://overpass-api.de/api/interpreter'),
 coverage:z.array(z.object({code:regionCode,name:z.string(),relationId:z.number().int().positive(),boundaryStatus:z.enum(['administrative','historic']),currentName:z.string().nullable(),
  collectedAt:z.string().datetime(),sourceTimestamp:z.string().datetime(),count:z.number().int().nonnegative()})).length(17),
 records:z.array(koreaRecordSchema).max(500000),
}).superRefine((s,ctx)=>{
 if(new Set(s.coverage.map(c=>c.code)).size!==17||new Set(s.records.map(p=>p.id)).size!==s.records.length)
  ctx.addIssue({code:'custom',message:'지역 구획 또는 장소 ID가 누락·중복되었습니다.'});
 for(const c of s.coverage){if(c.count!==s.records.filter(r=>r.provinces.includes(c.code)).length||c.count===0)
  ctx.addIssue({code:'custom',message:`${c.code} 수집 건수가 맞지 않습니다.`});}
});
export type KoreaSnapshot=z.infer<typeof koreaSnapshotSchema>;
const elementSchema=z.object({type:z.enum(['node','way','relation']),id:z.number().int().positive(),
 lat:z.number().optional(),lon:z.number().optional(),center:z.object({lat:z.number(),lon:z.number()}).optional(),
 tags:z.record(z.string(),z.string()).default({})});
export function koreaCategory(tags:Record<string,string>):KoreaCategory {
 if(tags.amenity==='restaurant'||tags.amenity==='fast_food'||tags.amenity==='food_court')return 'food';
 if(tags.amenity==='cafe')return 'cafe';
 if(tags.amenity==='bench'||tags.tourism==='picnic_site')return 'rest';
 if(['hotel','motel','hostel','guest_house','chalet','camp_site','caravan_site','apartment','alpine_hut','wilderness_hut'].includes(tags.tourism))return 'lodging';
 if(tags.shop)return 'shopping';
 if(tags.tourism==='museum'||tags.tourism==='gallery'||['theatre','arts_centre'].includes(tags.amenity))return 'culture';
 if(tags.historic)return 'heritage';
 if(tags.natural==='beach'||['park','nature_reserve','garden'].includes(tags.leisure)||tags.boundary==='national_park')return 'nature';
 if(tags.leisure)return 'leisure';
 return 'attraction';
}
export function parseKoreaRegion(data:unknown,code:typeof koreaRegions[number]['code']){
 const envelope=z.object({osm3s:z.object({timestamp_osm_base:z.string().datetime()}),remark:z.string().optional(),elements:z.array(z.unknown()).max(500001)}).parse(data);
 if(envelope.remark)throw Error(`불완전한 공급자 응답: ${envelope.remark}`);
 const counts=envelope.elements.filter(e=>(e as {type?:string})?.type==='count');
 const count=z.object({tags:z.object({total:z.string().regex(/^\d+$/)})}).parse(counts[0]);
 if(counts.length!==1)throw Error('공급자 건수 확인이 누락되었습니다.');
 const elements=envelope.elements.filter(e=>(e as {type?:string})?.type!=='count').map(e=>elementSchema.parse(e));
 if(elements.length!==Number(count.tags.total)||new Set(elements.map(e=>`${e.type}:${e.id}`)).size!==elements.length)throw Error('공급자 응답이 잘렸거나 중복되었습니다.');
 const records=elements.map(e=>{
  const category=koreaCategory(e.tags),id=`osm:${e.type}:${e.id}`;
  const tags=Object.fromEntries(Object.entries(e.tags).filter(([k])=>/^(name(:ko|:en)?|addr:.*|tourism|historic|natural|leisure|amenity|boundary|shop|cuisine|wheelchair|bench|seats|step_count|highway|opening_hours|website|contact:website)$/.test(k)).map(([k,v])=>[k.slice(0,100),v.slice(0,3000)]));
  const name=e.tags['name:ko']?.trim()||e.tags.name?.trim()||e.tags['name:en']?.trim();
  const latitude=e.lat??e.center?.lat??null,longitude=e.lon??e.center?.lon??null;
  return koreaRecordSchema.parse({id,name:(name||`이름 미등록 ${koreaCategories[category]} (${id})`).slice(0,300),nameKnown:!!name,category,provinces:[code],latitude,longitude,
   address:['province','city','district','suburb','quarter','street','housenumber'].map(k=>tags['addr:'+k]).filter(Boolean).join(' ').slice(0,1000),tags});
 });
 return {records,sourceTimestamp:envelope.osm3s.timestamp_osm_base};
}

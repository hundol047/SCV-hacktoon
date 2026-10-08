import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {koreaRegions,koreaSnapshotSchema,parseKoreaRegion,type KoreaSnapshot} from '../src/data/korea-tourism';
import {koreaCatalog,koreaPlace,koreaRoutePlaces,readKoreaSnapshot,searchKorea} from '../src/server/korea-tourism';
import {GET} from '../src/app/api/tourism/route';
import {mergeCatalog} from '../src/domain/world';
const at=new Date().toISOString();
const data=(elements:unknown[])=>({osm3s:{timestamp_osm_base:at},elements:[...elements,{type:'count',id:0,tags:{total:String(elements.length)}}]});
const source=data([
 {type:'node',id:1,lat:37.58,lon:126.98,tags:{name:'경복궁',historic:'palace','addr:city':'서울특별시','addr:district':'종로구'}},
 {type:'node',id:2,lat:37.58,lon:126.98,tags:{name:'종로 한식집',amenity:'restaurant',cuisine:'korean'}},
 {type:'node',id:3,lat:37.58,lon:126.98,tags:{amenity:'bench'}},
 {type:'node',id:4,lat:37.58,lon:126.98,tags:{name:'종로 숙소',tourism:'hotel'}},
 {type:'node',id:5,lat:37.58,lon:126.98,tags:{name:'종로 커피',amenity:'cafe',opening_hours:'24/7',wheelchair:'yes'}},
]);
const snapshot=():KoreaSnapshot=>({version:1,queryVersion:1,collectedAt:at,license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',source:'https://overpass-api.de/api/interpreter',coverage:koreaRegions.map(r=>({...r,relationId:1,boundaryStatus:'administrative',currentName:null,collectedAt:at,sourceTimestamp:at,count:r.code==='KR-11'?5:0})),records:parseKoreaRegion(source,'KR-11').records});
it('national parsing rejects truncated, duplicate and provider runtime-error responses',()=>{
 expect(()=>parseKoreaRegion({...source,remark:'runtime error: timeout'},'KR-11')).toThrow();
 expect(()=>parseKoreaRegion({...source,elements:source.elements.slice(1)},'KR-11')).toThrow();
 expect(()=>parseKoreaRegion(data([source.elements[0],source.elements[0]]),'KR-11')).toThrow();
 expect(()=>parseKoreaRegion({...source,elements:source.elements.slice(0,-1)},'KR-11')).toThrow();
});
it('unnamed amenities remain in the full dataset and provider tags do not invent facility facts',()=>{
 const s=snapshot();expect(s.records).toHaveLength(5);expect(s.records[2].nameKnown).toBe(false);expect(s.records[3].category).toBe('lodging');
 const cafe=koreaPlace(s.records[4],s,'서울특별시');expect(cafe.hours.value).toBeNull();expect(cafe.stairs.value).toBeNull();expect(cafe.walkMin.value).toBeNull();expect(cafe.cost.value).toBeNull();expect(cafe.seat.value).toBeNull();
 expect(cafe.walkMin.source).toBe('https://www.openstreetmap.org/node/5');expect(cafe.walkMin.collectedAt).toBe(at);
});
it('province, cuisine, Unicode-normalized name and category searches paginate without loss',()=>{
 const s=snapshot();expect(searchKorea(s,'ＫＯＲＥＡＮ','KR-11').records[0].id).toBe('osm:node:2');
 expect(searchKorea(s,'종로구').records[0].id).toBe('osm:node:1');expect(searchKorea(s,'','KR-26').total).toBe(0);
 expect(searchKorea(s,'','KR-11','lodging').records.map(r=>r.id)).toEqual(['osm:node:4']);
 expect([1,2,3].flatMap(p=>searchKorea(s,'','KR-11','',p,2).records.map(r=>r.id))).toEqual(s.records.map(r=>r.id));
});
it('itinerary candidates preserve all kinds while excluding unnamed seats, lodging and shops',()=>{
 const s=snapshot(),catalog=koreaCatalog(s,'KR-11','',10);expect(catalog.places.map(p=>p.id).sort()).toEqual(['osm:node:1','osm:node:2','osm:node:5']);
 expect(new Set(catalog.places.map(p=>p.kind))).toEqual(new Set(['visit','meal','rest']));expect(catalog.cities?.[0].timezone).toBe('Asia/Seoul');expect(catalog.places.every(p=>p.cost.value===null)).toBe(true);
 expect(()=>koreaCatalog(s,'')).toThrow();expect(koreaCatalog(s,'KR-11','없는 이름').places).toEqual([]);
});
it('an incomplete regional collection cannot become a published nationwide snapshot',()=>{
 expect(koreaSnapshotSchema.safeParse(snapshot()).success).toBe(false);
 const s=snapshot();s.coverage.pop();expect(koreaSnapshotSchema.safeParse(s).success).toBe(false);
});
it('different searches within one region keep one city identity instead of requiring an intercity transfer',()=>{
 const s=snapshot(),a=koreaCatalog(s,'KR-11','경복궁',10),b=koreaCatalog(s,'KR-11','종로',10);
 expect(a.region).toBe('서울특별시');expect(b.region).toBe(a.region);expect(mergeCatalog(a,b).cities).toHaveLength(1);expect(b.sourceNotice).toContain('종로');
});
it('committed actual nationwide records match the gzip digest and each of the 17 coverage counts',async()=>{
 const manifest=JSON.parse(await readFile('data/korea-tourism/manifest.json','utf8')),compressed=await readFile('data/korea-tourism/snapshot.json.gz'),s=await readKoreaSnapshot();
 expect(createHash('sha256').update(compressed).digest('hex')).toBe(manifest.sha256);expect(s.records.length).toBe(manifest.total);
 expect(s.coverage).toHaveLength(17);expect(s.coverage.every(r=>r.count>0)).toBe(true);expect(new Set(s.records.map(r=>r.id)).size).toBe(s.records.length);
 expect(searchKorea(s,'경복궁','KR-11').total).toBeGreaterThan(0);
 for(const r of s.coverage)expect(searchKorea(s,'',r.code).total).toBe(r.count);
});
it('public snapshot API rejects malformed filters and does not require private storage or external APIs',async()=>{
 for(const query of ['page=0','province=KR-99','category=fake','action=catalog','limit=999','q='+encodeURIComponent('가'.repeat(121))])expect((await GET(new Request('http://localhost/api/tourism?'+query))).status).toBe(400);
 const r=await GET(new Request('http://localhost/api/tourism?province=KR-11&q='+encodeURIComponent('경복궁')));expect(r.status).toBe(200);const body=await r.json();expect(body.total).toBeGreaterThan(0);expect(body.dataset.coverage).toHaveLength(17);
});
it('snapshot route endpoints remain usable when the city provider cache is absent',async()=>{
 const s=await readKoreaSnapshot(),selected=koreaCatalog(s,'KR-11','',10).places.slice(0,2),ids=selected.map(p=>p.id);
 const endpoints=await koreaRoutePlaces(ids,'서울특별시');expect(endpoints?.map(p=>p.id)).toEqual(ids);expect(endpoints?.map(p=>[p.latitude,p.longitude])).toEqual(selected.map(p=>[p.latitude,p.longitude]));expect(await koreaRoutePlaces(['osm:node:999999999999999'],'서울특별시')).toBeNull();
});

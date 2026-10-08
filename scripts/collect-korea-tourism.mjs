// Node 24 (native TypeScript support); public OSM records, no paid API or private account.
import {readFile,writeFile,mkdir,rename,stat,open} from 'node:fs/promises';
import {unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {koreaRegions,koreaSnapshotSchema,parseKoreaRegion,koreaCategories} from '../src/data/korea-tourism.ts';

const root=new URL('../',import.meta.url),cache=new URL('.cache/korea-tourism/',root),output=new URL('data/korea-tourism/',root);
const endpoint='https://overpass-api.de/api/interpreter';
await mkdir(cache,{recursive:true});await mkdir(output,{recursive:true});
const lock=new URL('collector.lock',cache);
try{const handle=await open(lock,'wx');await handle.writeFile(String(process.pid));await handle.close();}catch{throw Error('다른 수집기가 실행 중이거나 이전 lock이 남아 있습니다. 실행 중인 수집기를 확인한 뒤 재개하세요.');}
const unlock=()=>{try{unlinkSync(lock);}catch{}};
process.on('exit',unlock);process.on('SIGINT',()=>process.exit(130));process.on('SIGTERM',()=>process.exit(143));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(query,maxAttempts=3){
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  try{
   // Reduce the public server's resource reservation without limiting output rows.
   const executionQuery=query.replace('[timeout:60]','[timeout:25][maxsize:134217728]');
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Bopok-public-tourism-collector/1.0 (+https://github.com/hundol047/SCV-hacktoon)'},body:new URLSearchParams({data:executionQuery}),signal:AbortSignal.timeout(90000)});
   if(!r.ok){const e=new Error(`HTTP ${r.status}`);e.status=r.status;e.retryAfter=Number(r.headers.get('retry-after'));throw e;}
   const text=await r.text();if(Buffer.byteLength(text)>128*1024*1024)throw Error('응답 크기 한도 초과');
   const data=JSON.parse(text);if(data.remark)throw Error(data.remark);return data;
  }catch(e){if(attempt===maxAttempts)throw e;const wait=e.status===429?Math.min(60000,Math.max(30000,(e.retryAfter||0)*1000)):20000;process.stdout.write(`공급자 재시도 ${attempt}: ${e.message}, ${wait/1000}초 대기\n`);await pause(wait);}
 }
}
async function area(region){
 const file=new URL(region.code+'-area.json',cache);
 try{const a=JSON.parse(await readFile(file,'utf8')),age=Date.now()-(await stat(file)).mtimeMs;if(age>=0&&age<7*86400000&&a.code===region.code&&Number.isSafeInteger(a.id)&&a.id>0)return {...a,boundaryStatus:a.boundaryStatus??'administrative',currentName:a.currentName??null};}catch{}
 const url=new URL('https://nominatim.openstreetmap.org/search');url.search=new URLSearchParams({q:region.name,format:'jsonv2',countrycodes:'kr',limit:'1',addressdetails:'1',extratags:'1'}).toString();
 const response=await fetch(url,{headers:{'User-Agent':'Bopok-public-tourism-collector/1.0 (+https://github.com/hundol047/SCV-hacktoon)'},signal:AbortSignal.timeout(15000)});
 if(response.ok){const list=await response.json(),e=list[0];
  if(list.length===1&&e.osm_type==='relation'&&e.name===region.name&&['administrative','historic'].includes(e.type)&&(e.extratags?.['ISO3166-2']===region.code||Object.values(e.address??{}).includes(region.code))){
   const a={code:region.code,id:e.osm_id,boundaryStatus:e.type,currentName:e.address?.state??null};await writeFile(file,JSON.stringify(a));await pause(1200);return a;
  }
 }
 await pause(1200);
 const data=await request(`[out:json][timeout:25];rel["boundary"="administrative"]["ISO3166-2"="${region.code}"];out tags;`);
 const matches=data.elements.filter(e=>e.type==='relation'&&e.tags?.['ISO3166-2']===region.code&&e.tags?.boundary==='administrative');
 if(matches.length!==1)throw Error(`${region.name} 경계 관계가 유일하지 않습니다.`);
 const a={code:region.code,id:matches[0].id,boundaryStatus:'administrative',currentName:null};await writeFile(file,JSON.stringify(a));await pause(1200);return a;
}
const filters=['["tourism"]','["historic"]','["amenity"~"^(restaurant|fast_food|food_court|cafe|bench|theatre|arts_centre)$"]','["natural"="beach"]','["leisure"~"^(park|nature_reserve|garden|water_park|sports_centre)$"]','["boundary"="national_park"]','["shop"~"^(mall|department_store|gift|souvenir)$"]'];
export function provinceQuery(id,selected=filters){return `[out:json][timeout:60];area(${3600000000+id})->.p;(${selected.map(filter=>`nwr(area.p)${filter};`).join('')});out center tags;out count;`;}
async function provinceData(id,code){
 try{return await request(provinceQuery(id),1);}catch{
  process.stdout.write('큰 질의가 실패하여 분류별 작은 질의로 나눕니다.\n');
  await pause(20000);
  const region=koreaRegions.find(r=>r.code===code);
  const url=new URL('https://nominatim.openstreetmap.org/search');url.search=new URLSearchParams({q:region.name,format:'jsonv2',countrycodes:'kr',limit:'1'}).toString();
  const r=await fetch(url,{headers:{'User-Agent':'Bopok-public-tourism-collector/1.0 (+https://github.com/hundol047/SCV-hacktoon)'},signal:AbortSignal.timeout(15000)});
  const loc=r.ok?(await r.json())[0]:null;
  const box=loc?.osm_type==='relation'&&loc.osm_id===id?loc.boundingbox.map(Number):null;
  const bbox=box?.length===4&&box.every(Number.isFinite)?`[bbox:${box[0]-0.01},${box[2]-0.01},${box[1]+0.01},${box[3]+0.01}]`:'';
  await pause(1200);
  const elements=new Map(),failed=[];let timestamp,firstCollectedAt;
  for(const filter of filters){
   try{
   const query=provinceQuery(id,[filter]),key=createHash('sha256').update(query).digest('hex'),file=new URL(code+'-'+key+'.json',cache);
   let data,collectedAt;
   if(!process.argv.includes('--fresh'))try{const c=JSON.parse(await readFile(file,'utf8'));const age=Date.now()-Date.parse(c.collectedAt);if(age>=0&&age<86400000){parseKoreaRegion(c.data,code);data=c.data;collectedAt=c.collectedAt;}}catch{}
   if(!data){data=await request(query.replace('[timeout:60]',`[timeout:60]${bbox}`));collectedAt=new Date().toISOString();parseKoreaRegion(data,code);await writeFile(file,JSON.stringify({collectedAt,data}));await pause(1500);}
   firstCollectedAt=!firstCollectedAt||collectedAt<firstCollectedAt?collectedAt:firstCollectedAt;
   parseKoreaRegion(data,code);const at=data.osm3s.timestamp_osm_base;timestamp=!timestamp||at<timestamp?at:timestamp;
   for(const e of data.elements)if(e.type!=='count')elements.set(`${e.type}:${e.id}`,e);
   process.stdout.write(`${code} ${filter}: ${data.elements.length-1}건 확인\n`);
   }catch(e){failed.push(filter);process.stdout.write(`${code} ${filter} 수집 보류: ${e.message}\n`);}
  }
  if(failed.length)throw Error(`${code} 미완료 분류: ${failed.join(', ')}`);
  return {bopokCollectedAt:firstCollectedAt,osm3s:{timestamp_osm_base:timestamp},elements:[...elements.values(),{type:'count',id:0,tags:{total:String(elements.size)}}]};
 }
}
const records=new Map(),coverage=[],failed=[];
for(const region of koreaRegions){
 try{
 const boundary=await area(region),id=boundary.id,query=provinceQuery(id),queryHash=createHash('sha256').update(query).digest('hex'),file=new URL(region.code+'.json',cache);
 let data,collectedAt;
 if(!process.argv.includes('--fresh'))try{
  const c=JSON.parse(await readFile(file,'utf8'));
  const age=Date.now()-Date.parse(c.collectedAt);
  if(c.queryHash===queryHash&&age>=0&&age<86400000){parseKoreaRegion(c.data,region.code);data=c.data;collectedAt=c.collectedAt;}
 }catch{}
 if(!data){
  process.stdout.write(`${region.name}: 전체 등록 항목 수집\n`);data=await provinceData(id,region.code);collectedAt=data.bopokCollectedAt??new Date().toISOString();parseKoreaRegion(data,region.code);
  await writeFile(new URL(region.code+'.json.tmp',cache),JSON.stringify({queryHash,collectedAt,data}));
  await rename(new URL(region.code+'.json.tmp',cache),file);await pause(1500);
 }
 const parsed=parseKoreaRegion(data,region.code);
 coverage.push({...region,relationId:id,boundaryStatus:boundary.boundaryStatus,currentName:boundary.currentName,collectedAt,sourceTimestamp:parsed.sourceTimestamp,count:parsed.records.length});
 for(const record of parsed.records){const previous=records.get(record.id);if(previous)previous.provinces.push(region.code);else records.set(record.id,record);}
 process.stdout.write(`${region.name}: ${parsed.records.length}건 확인\n`);
 }catch(e){failed.push(region.name);process.stdout.write(`${region.name} 수집 보류: ${e.message}\n`);}
}
if(failed.length)throw Error(`전국 수집 미완료: ${failed.join(', ')}. 검증된 지역 캐시는 보존했고 기존 공개 데이터는 교체하지 않았습니다. 다음 실행에서 재개하세요.`);
const snapshot=koreaSnapshotSchema.parse({version:1,queryVersion:1,collectedAt:coverage.map(c=>c.collectedAt).sort().at(-1),license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',source:endpoint,coverage,records:[...records.values()].sort((a,b)=>a.id.localeCompare(b.id))});
const compressed=gzipSync(JSON.stringify(snapshot),{level:9});
const manifest={...snapshot,records:undefined,total:snapshot.records.length,compressedBytes:compressed.length,sha256:createHash('sha256').update(compressed).digest('hex'),
 categories:Object.fromEntries(Object.keys(koreaCategories).map(k=>[k,snapshot.records.filter(r=>r.category===k).length])),
 missingNames:snapshot.records.filter(r=>!r.nameKnown).length,missingCoordinates:snapshot.records.filter(r=>r.latitude===null||r.longitude===null).length,
 missingAddresses:snapshot.records.filter(r=>!r.address.trim()).length,
 sourceScope:{objectTypes:['node','way','relation'],filters},
 completeness:'선택한 OSM 분류의 17개 지역 구획 응답 건수 대조 완료. 대한민국의 모든 실제 시설·축제·운영정보를 뜻하지 않음.'};
await writeFile(new URL('snapshot.json.gz.tmp',output),compressed);await rename(new URL('snapshot.json.gz.tmp',output),new URL('snapshot.json.gz',output));
await writeFile(new URL('manifest.json.tmp',output),JSON.stringify(manifest,null,2)+'\n');await rename(new URL('manifest.json.tmp',output),new URL('manifest.json',output));
process.stdout.write(`완료: 17개 지역 구획 / 중복 제거 ${manifest.total}건 / gzip ${compressed.length} bytes\n`);

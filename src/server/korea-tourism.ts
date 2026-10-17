import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {koreaSnapshotSchema,koreaCategories,koreaRegions,type KoreaSnapshot,type KoreaRecord,type KoreaCategory} from '../data/korea-tourism';
import {catalogSchema,type Catalog} from '../data/catalog';
import type {Place,Fact} from '../data/demo';

let pending:Promise<KoreaSnapshot>|undefined;
export async function readKoreaSnapshot(){
 if(!pending)pending=(async()=>{
  const dir=join(process.cwd(),'data/korea-tourism');
  const [compressed,manifestText]=await Promise.all([readFile(join(dir,'snapshot.json.gz')),readFile(join(dir,'manifest.json'),'utf8')]);
  const manifest=JSON.parse(manifestText);
  if(compressed.length>32*1024*1024||createHash('sha256').update(compressed).digest('hex')!==manifest.sha256)throw Error('전국 자료 무결성 확인 실패');
  const snapshot=koreaSnapshotSchema.parse(JSON.parse(gunzipSync(compressed,{maxOutputLength:256*1024*1024}).toString('utf8')));
  if(snapshot.records.length!==manifest.total||snapshot.collectedAt!==manifest.collectedAt)throw Error('전국 자료 건수 불일치');
  return snapshot;
 })().catch(e=>{pending=undefined;throw e;});
 return pending;
}
export {searchKorea,koreaCatalog,koreaPlace} from '../data/korea-catalog';
import {koreaPlace} from '../data/korea-catalog';
export async function koreaRoutePlaces(ids:string[],region:string){
 if(!ids.every(id=>/^osm:(node|way|relation):[1-9]\d*$/.test(id)))return null;
 try{const snapshot=await readKoreaSnapshot(),records=ids.map(id=>snapshot.records.find(r=>r.id===id));if(records.some(r=>!r))return null;return records.map(r=>koreaPlace(r!,snapshot,region));}catch{return null;}
}

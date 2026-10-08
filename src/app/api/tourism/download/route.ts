import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {join} from 'node:path';
import {readKoreaSnapshot} from '../../../../server/korea-tourism';
import {json} from '../../../../server/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const snapshot=await readKoreaSnapshot(),stream=Readable.toWeb(createReadStream(join(process.cwd(),'data/korea-tourism/snapshot.json.gz')));
  return new Response(stream as ReadableStream<Uint8Array>,{headers:{'Content-Type':'application/gzip','Content-Disposition':`attachment; filename="bopok-korea-osm-${snapshot.collectedAt.slice(0,10)}.json.gz"`,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
 }catch{return json({error:'전국 수집 자료를 읽지 못했습니다.'},503);}
}

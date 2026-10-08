// Optional official nationwide BASIC listings. Requires a user-issued key, not a paid probe.
// Images, detail/intro/repeat records, accessibility and live opening facts are not downloaded.
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const key=process.env.BOPok_TOURAPI_KEY;
if(!key){process.stderr.write('공식 전국 목록 수집에는 BOPok_TOURAPI_KEY가 필요합니다. 환경 설정에 발급받은 원문(Decoding) 키를 넣어 주세요. 키를 채팅에 보내지 마세요.\n');process.exit(1);}
const endpoint='https://apis.data.go.kr/B551011/KorService2/areaBasedList2',size=100,maxRequests=2000;
const records=new Map();let total;
const fields=['contentid','contenttypeid','title','addr1','addr2','areacode','sigungucode','cat1','cat2','cat3','mapx','mapy','mlevel','modifiedtime','createdtime','tel','zipcode'];
for(let page=1;page<=maxRequests;page++){
 const url=new URL(endpoint);url.search=new URLSearchParams({serviceKey:key,MobileOS:'ETC',MobileApp:'Bopok',_type:'json',numOfRows:String(size),pageNo:String(page),arrange:'A'}).toString();
 let data;
 try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();}catch{throw Error('공식 공급자 요청이 실패했습니다. 인증·쿼터·API 상태를 확인하세요. URL/인증값은 출력하지 않습니다.');}
 const header=data?.response?.header,body=data?.response?.body;
 if(!['0000','00'].includes(String(header?.resultCode)))throw Error('공식 공급자가 인증·쿼터·요청 오류를 반환했습니다. 기존 파일은 유지합니다.');
 const count=Number(body?.totalCount);if(!Number.isSafeInteger(count)||count<1||count>200000)throw Error('공식 전체 건수가 유효하지 않습니다.');
 if(total!==undefined&&total!==count)throw Error('수집 중 전체 건수가 바뀌었습니다. 다음 실행에서 다시 수집하세요.');total=count;
 if(Number(body.pageNo)!==page)throw Error('공식 페이지 번호가 맞지 않습니다.');
 const items=body.items?.item,rows=Array.isArray(items)?items:items&&typeof items==='object'?[items]:[];
 if(rows.length!==Math.min(size,total-(page-1)*size))throw Error('공식 응답 페이지가 잘렸거나 누락되었습니다.');
 for(const r of rows){
  if(!/^\d+$/.test(String(r.contentid))||typeof r.title!=='string'||!r.title.trim()||records.has(String(r.contentid)))throw Error('공식 목록에 유효하지 않거나 중복된 ID가 있습니다.');
  records.set(String(r.contentid),Object.fromEntries(fields.filter(f=>r[f]!==undefined).map(f=>[f,String(r[f]).slice(0,3000)])));
 }
 process.stdout.write(`공식 기본 목록 ${records.size}/${total}건\n`);
 if(records.size===total)break;
 if(page===maxRequests)throw Error('최대 요청 횟수에 도달했습니다. 불완전한 파일은 저장하지 않습니다.');
 await new Promise(resolve=>setTimeout(resolve,1100));
}
if(records.size!==total)throw Error('공식 전체 건수 대조 실패');
const snapshot={version:1,collectedAt:new Date().toISOString(),source:endpoint,total,scope:'TourAPI areaBasedList2 전국 기본 목록. 사진·상세 시설·메뉴·실시간 영업/축제 확인은 포함하지 않음.',records:[...records.values()]};
const compressed=gzipSync(JSON.stringify(snapshot),{level:9}),dir=process.env.BOPok_TOURAPI_OUTPUT_DIR?pathToFileURL(resolve(process.env.BOPok_TOURAPI_OUTPUT_DIR)+'/'):new URL('../data/korea-tourism/',import.meta.url);await mkdir(dir,{recursive:true});
await writeFile(new URL('tourapi-basic.json.gz.tmp',dir),compressed);await rename(new URL('tourapi-basic.json.gz.tmp',dir),new URL('tourapi-basic.json.gz',dir));
await writeFile(new URL('tourapi-manifest.json.tmp',dir),JSON.stringify({...snapshot,records:undefined,sha256:createHash('sha256').update(compressed).digest('hex')},null,2)+'\n');await rename(new URL('tourapi-manifest.json.tmp',dir),new URL('tourapi-manifest.json',dir));
process.stdout.write(`공식 기본 목록 수집 완료: ${total}건. 이용 조건·교차 출처 중복 확인 후 앱 자료에 별도 통합해야 합니다.\n`);

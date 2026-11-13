import type {TripEvidence} from '../domain/trip-evidence';
// Uncompressed UTF-8 ZIP: works offline without loading an external archive library.
function crc32(data:Uint8Array){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function makeZip(files:{name:string;bytes:Uint8Array}[]){
 const local:Uint8Array<ArrayBuffer>[]=[],central:Uint8Array<ArrayBuffer>[]=[];let offset=0;
 for(const file of files){const name=new TextEncoder().encode(file.name),bytes=new Uint8Array(file.bytes);const crc=crc32(bytes);const header=new Uint8Array(30+name.length),h=new DataView(header.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,0x21,true);h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);header.set(name,30);local.push(header,bytes);
 const directory=new Uint8Array(46+name.length),d=new DataView(directory.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,0x21,true);d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);directory.set(name,46);central.push(directory);offset+=header.length+bytes.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,central.reduce((n,b)=>n+b.length,0),true);e.setUint32(16,offset,true);return new Blob([...local,...central,end],{type:'application/zip'});
}
export async function evidencePackage(rows:TripEvidence[],draft:string){if(rows.length>40||rows.reduce((n,r)=>n+r.original.size,0)>100*1024*1024)throw Error('파일 묶음 크기를 확인하세요.');const files=await Promise.all(rows.map(async(r,i)=>({name:`증빙/${String(i+1).padStart(2,'0')}-${r.kind==='receipt'?'영수증':'방문사진'}.${r.original.type==='image/png'?'png':r.original.type==='image/webp'?'webp':'jpg'}`,bytes:new Uint8Array(await r.original.arrayBuffer())})));
 const manifest=rows.map((r,i)=>`${files[i].name}\n원본 파일명: ${r.name.replace(/[\r\n]/g,' ')}\n내용: ${r.reading.label.replace(/[\r\n]/g,' ')} / ${r.reading.date??'날짜 확인 필요'} / ${r.confirmed?'사용자 확인 기록 있음':'확인 필요'}`).join('\n\n');const encode=(s:string)=>new TextEncoder().encode(s);
 return makeZip([{name:'신청-정산-초안.txt',bytes:encode(draft)},{name:'제출전-확인.txt',bytes:encode('공식 신청서가 아닌 제출 검토용 자료 묶음입니다.\n지정 관광지·인정 결제수단·거주지 요건·마감일을 공식 공고와 확인하세요.\n확인되지 않은 증빙도 포함되어 있으므로 제출 전 원본을 검토하세요.\n\n'+manifest)},...files]);
}

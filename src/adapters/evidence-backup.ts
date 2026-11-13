import {z} from 'zod';
import {evidenceReadingSchema,type TripEvidence} from '../domain/trip-evidence';
const b64=z.string().max(24*1024*1024).regex(/^[A-Za-z0-9+/]*={0,2}$/);
const file=z.object({type:z.enum(['image/jpeg','image/png','image/webp']),data:b64});
const record=z.object({id:z.string().min(1).max(100),tripId:z.string().min(1).max(100),city:z.string().min(1).max(100),kind:z.enum(['receipt','visit']),name:z.string().min(1).max(160),createdAt:z.string().datetime(),original:file,preview:file,reading:evidenceReadingSchema,confirmed:z.boolean()});
const archive=z.object({version:z.literal(1),tripId:z.string().min(1).max(100),city:z.string().min(1).max(100),draft:z.string().max(200000),rows:z.array(record).max(40)});
export const encryptedBackupSchema=z.object({version:z.literal(1),salt:z.string().length(24),iv:z.string().length(16),ciphertext:b64});
const encode=(v:Uint8Array)=>{let s='';for(let i=0;i<v.length;i+=8192)s+=String.fromCharCode(...v.subarray(i,i+8192));return btoa(s);};
const decode=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
async function key(password:string,salt:Uint8Array<ArrayBuffer>){if(!globalThis.crypto?.subtle)throw Error('암호화 백업은 HTTPS 또는 localhost에서 사용할 수 있어요.');if(password.length<12||password.length>200)throw Error('백업 암호를 12~200자로 입력하세요.');const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function createEvidenceBackup(tripId:string,city:string,rows:TripEvidence[],draft:string,password:string){
 const selected=rows.filter(r=>r.tripId===tripId&&r.city===city);if(selected.reduce((n,r)=>n+r.original.size+r.preview.size,0)>12*1024*1024)throw Error('백업 한 묶음은 사진 원본·미리보기 합계 12MB까지 지원해요. 원본을 별도로 내려받고 자료를 정리하세요.');
 const converted=await Promise.all(selected.map(async r=>({...r,original:{type:r.original.type,data:encode(new Uint8Array(await r.original.arrayBuffer()))},preview:{type:r.preview.type,data:encode(new Uint8Array(await r.preview.arrayBuffer()))}})));
 const data=archive.parse({version:1,tripId,city,rows:converted,draft});const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const aes=await key(password,salt);const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,new TextEncoder().encode(JSON.stringify(data)));return encryptedBackupSchema.parse({version:1,salt:encode(salt),iv:encode(iv),ciphertext:encode(new Uint8Array(ciphertext))});
}
export async function openEvidenceBackup(raw:unknown,password:string,tripId:string,city:string){const e=encryptedBackupSchema.parse(raw);const salt=decode(e.salt),iv=decode(e.iv);if(salt.length!==16||iv.length!==12)throw Error('백업 형식이 올바르지 않아요.');let plain:ArrayBuffer;try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},await key(password,salt),decode(e.ciphertext));}catch{throw Error('암호가 다르거나 손상된 백업입니다. HTTPS 연결도 확인하세요.');}const data=archive.parse(JSON.parse(new TextDecoder().decode(plain)));if(data.tripId!==tripId||data.city!==city)throw Error('현재 여행·지역과 다른 백업입니다. 원래 여행을 먼저 열어 주세요.');
 const rows=data.rows.map(r=>{if(r.tripId!==tripId||r.city!==city)throw Error('여행이 섞인 백업입니다.');const original=decode(r.original.data),preview=decode(r.preview.data);if(original.length>10*1024*1024||preview.length>2*1024*1024)throw Error('사진 크기 제한을 초과합니다.');return {...r,original:new Blob([original],{type:r.original.type}),preview:new Blob([preview],{type:r.preview.type}),confirmed:false};});
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('중복된 증빙 식별자가 있어요.');return {rows,draft:data.draft};
}

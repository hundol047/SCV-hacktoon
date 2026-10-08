import { createHash,createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
export const COOKIE='bopok_session';
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
function signingKey(){const key=process.env.BOPok_SESSION_SECRET;if(!key||key.length<32)throw Error('Session configuration missing');return key;}
export function issueSession(now=Date.now()){const body=`${token()}.${now}`;return `${body}.${createHmac('sha256',signingKey()).update(body).digest('base64url')}`;}
export function verifySession(value:string,now=Date.now()):string|null{try{const [id,at,sig,...rest]=value.split('.');if(rest.length||!/^[-\w]{43}$/.test(id)||!Number.isSafeInteger(Number(at))||Number(at)>now||now-Number(at)>30*86400000)return null;const expected=createHmac('sha256',signingKey()).update(`${id}.${at}`).digest();const actual=Buffer.from(sig,'base64url');return actual.length===expected.length&&timingSafeEqual(actual,expected)?hash(id):null;}catch{return null;}}
export function ownerOf(request:Request){const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return cookie?verifySession(cookie):null;}
export function capabilityOf(request:Request){const value=request.headers.get('authorization')?.match(/^Bearer ([-\w]{43})$/)?.[1];return value?hash(value):'';}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');const configured=process.env.BOPok_APP_URL;const expected=configured?new URL(configured).origin:new URL(request.url).origin;return origin===expected;}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});}
export async function readJSON(request:Request,max=524288){if(Number(request.headers.get('content-length')??0)>max)throw Error('Too large');const reader=request.body?.getReader();if(!reader)throw Error('Empty');let bytes=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>max){await reader.cancel();throw Error('Too large');}chunks.push(value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}

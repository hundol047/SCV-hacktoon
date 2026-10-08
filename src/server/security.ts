import {appURL} from './config';
import { createHash,createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
import {accountOf,hasAccount,authRequired} from './account';
export const COOKIE='bopok_session';
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
function signingKey(){const key=process.env.BOPok_SESSION_SECRET;if(!key||key.length<32)throw Error('Session configuration missing');return key;}
export function issueSession(now=Date.now(),owner=hash(token())){if(!/^[a-f0-9]{64}$/.test(owner))throw Error('Invalid owner');const body=`v2.${owner}.${now}`;return `${body}.${createHmac('sha256',signingKey()).update(body).digest('base64url')}`;}
export function verifySession(value:string,now=Date.now()):string|null{try{
 const parts=value.split('.'),v2=parts[0]==='v2';
 if(parts.length!==(v2?4:3))return null;
 const [id,at,sig]=v2?parts.slice(1):parts;
 if(!(v2?/^[a-f0-9]{64}$/:/^[-\w]{43}$/).test(id)||!/^\d+$/.test(at)||!Number.isSafeInteger(Number(at))||Number(at)>now||now-Number(at)>30*86400000)return null;
 const expected=createHmac('sha256',signingKey()).update(parts.slice(0,-1).join('.')).digest(),actual=Buffer.from(sig,'base64url');
 return actual.length===expected.length&&timingSafeEqual(actual,expected)?(v2?id:hash(id)):null;
 }catch{return null;}}
export function sessionResponse(request:Request,owner:string,data:unknown){const response=json(data),secure=(appURL()??request.url).startsWith('https:');response.headers.set('Set-Cookie',`${COOKIE}=${issueSession(Date.now(),owner)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure?'; Secure':''}`);return response;}
export function anonymousOwner(request:Request){const value=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return value?verifySession(value):null;}
export function ownerOf(request:Request){const account=accountOf(request);if(account)return hash('account:'+account.id);if(hasAccount(request)||authRequired())return null;const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return cookie?verifySession(cookie):null;}
export function capabilityOf(request:Request){const value=request.headers.get('authorization')?.match(/^Bearer ([-\w]{43})$/)?.[1];return value?hash(value):'';}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');const configured=appURL();const expected=configured?new URL(configured).origin:new URL(request.url).origin;return origin===expected;}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});}
export class InputError extends Error {constructor(public status:400|413,message:string){super(message);}}
export async function readJSON(request:Request,max=8388608,allowEmpty=false){if(Number(request.headers.get('content-length')??0)>max)throw new InputError(413,'Too large');const reader=request.body?.getReader();if(!reader){if(allowEmpty)return {};throw new InputError(400,'Empty');}let bytes=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>max){await reader.cancel();throw new InputError(413,'Too large');}chunks.push(value);}if(bytes===0&&allowEmpty)return {};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new InputError(400,'Invalid JSON');}}

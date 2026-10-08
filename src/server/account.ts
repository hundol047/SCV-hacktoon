import {appURL} from './config';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
export function authRequired(){return process.env.BOPok_REQUIRE_AUTH!=='false'&&(process.env.BOPok_REQUIRE_AUTH==='true'||!!process.env.BOPok_SUPABASE_ANON_KEY||process.env.NODE_ENV==='production');}
export const ACCOUNT_COOKIE='bopok_account',REFRESH_COOKIE='bopok_refresh';
const identity=z.object({id:z.string().uuid(),email:z.string().email(),exp:z.number().int().positive()});
export type Account=z.infer<typeof identity>;
export const cookieValue=(request:Request,name:string)=>request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
function key(){const value=process.env.BOPok_SESSION_SECRET;if(!value||value.length<32)throw Error('Session configuration');return value;}
export function issueAccount(account:Account){const body=Buffer.from(JSON.stringify(identity.parse(account))).toString('base64url');return `${body}.${createHmac('sha256',key()).update('account:'+body).digest('base64url')}`;}
export function accountOf(request:Request,now=Date.now()):Account|null{try{const parts=cookieValue(request,ACCOUNT_COOKIE)?.split('.');if(!parts||parts.length!==2)return null;const expected=createHmac('sha256',key()).update('account:'+parts[0]).digest(),actual=Buffer.from(parts[1],'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const account=identity.parse(JSON.parse(Buffer.from(parts[0],'base64url').toString()));return account.exp>now/1000&&account.exp<=now/1000+3605?account:null;}catch{return null;}}
export function hasAccount(request:Request){return !!(cookieValue(request,ACCOUNT_COOKIE)||cookieValue(request,REFRESH_COOKIE));}
export function roleOf(account:Account|null,role:'reviewer'|'operator'){return !!account&&((process.env[role==='reviewer'?'BOPok_REVIEWER_IDS':'BOPok_OPERATOR_IDS']??'').split(',').map(v=>v.trim()).includes(account.id));}
export class AuthProvider{
 constructor(private url=process.env.BOPok_SUPABASE_URL??'',private anon=process.env.BOPok_SUPABASE_ANON_KEY??'',private fetcher:typeof fetch=fetch){const u=new URL(url);if((u.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(u.hostname))||!anon)throw Error('Auth configuration');}
 async call(path:string,body?:unknown,access?:string){const response=await this.fetcher(this.url.replace(/\/$/,'')+'/auth/v1/'+path,{method:body?'POST':'GET',headers:{apikey:this.anon,'Content-Type':'application/json',...(access?{Authorization:'Bearer '+access}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000),cache:'no-store'});if(!response.ok)throw Error('Auth rejected');return response.status===204?{}:await response.json();}
 async request(email:string){await this.call('otp',{email,create_user:true});}
 async verified(session:any){const token=z.string().min(1).parse(session.access_token),refresh=z.string().min(1).max(10000).parse(session.refresh_token);const user=z.object({id:z.string().uuid(),email:z.string().email()}).parse(await this.call('user',undefined,token));const lifetime=Math.min(3600,z.number().positive().parse(session.expires_in));return {account:{...user,exp:Math.floor(Date.now()/1000+lifetime)},refresh};}
 async verify(email:string,code:string){return this.verified(await this.call('verify',{email,token:code,type:'email'}));}
 async refresh(refresh:string){return this.verified(await this.call('token?grant_type=refresh_token',{refresh_token:refresh}));}
}
export function accountCookies(request:Request,response:Response,value?:{account:Account;refresh:string}){const secure=new URL(appURL()??request.url).protocol==='https:',suffix=`; HttpOnly; SameSite=Strict; Path=/${secure?'; Secure':''}`;response.headers.append('Set-Cookie',`${ACCOUNT_COOKIE}=${value?issueAccount(value.account):''}; Max-Age=${value?3600:0}${suffix}`);response.headers.append('Set-Cookie',`${REFRESH_COOKIE}=${value?value.refresh:''}; Max-Age=${value?2592000:0}${suffix}`);response.headers.append('Set-Cookie',`bopok_session=; Max-Age=0${suffix}`);return response;}

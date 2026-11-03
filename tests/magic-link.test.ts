import {it,expect,vi,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {POST} from '../src/app/api/account/route';
import {accountOf,AuthProvider} from '../src/server/account';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function setup(){for(const [k,v] of Object.entries({BOPok_APP_URL:'https://travel.example',BOPok_SUPABASE_URL:'https://db.supabase.co',BOPok_SUPABASE_KEY:'test-service',BOPok_SUPABASE_ANON_KEY:'test-anon',BOPok_SESSION_SECRET:'test-secret-at-least-thirty-two-characters',BOPok_REQUIRE_BOT:'false',BOPok_TURNSTILE_SECRET:''}))vi.stubEnv(k,v);}
function request(body:unknown,cookie='',origin='https://travel.example'){return new Request('https://travel.example/api/account',{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});}
it('magic links bind exchange to the requesting browser and issue verified HttpOnly account cookies',async()=>{
 setup();let challenge='';let exchanges=0;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
 const body=init.body?JSON.parse(String(init.body)):{};
 if(url.endsWith('/rpc/bopok_reserve'))return Response.json({allowed:true});
 if(url.endsWith('/rpc/bopok_metric'))return Response.json({recorded:true});
 if(url.endsWith('/auth/v1/otp')){challenge=body.code_challenge;expect(body.code_challenge_method).toBe('s256');return Response.json({});}
 if(url.endsWith('grant_type=pkce')){exchanges++;expect(body.auth_code).toBe('one-use-code');expect(createHash('sha256').update(body.code_verifier).digest('base64url')).toBe(challenge);return Response.json({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:'untrusted'}});}
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'00000000-0000-4000-8000-000000000001',email:'verified@example.org'});
 throw Error('Unexpected URL');
 }));
 const sent=await POST(request({action:'request',email:'verified@example.org'}));expect(sent.status).toBe(200);
 const verifier=sent.headers.getSetCookie().find(v=>v.startsWith('bopok_login_verifier='))!;expect(verifier).toContain('HttpOnly');expect(verifier).toContain('SameSite=Lax');expect(verifier).toContain('Secure');
 expect((await POST(request({action:'exchange',authCode:'one-use-code'}))).status).toBe(400);expect(exchanges).toBe(0);
 expect((await POST(request({action:'exchange',authCode:'one-use-code'},verifier.split(';')[0],'https://evil.example'))).status).toBe(403);
 const result=await POST(request({action:'exchange',authCode:'one-use-code'},verifier.split(';')[0]));expect(result.status).toBe(200);
 const cookies=result.headers.getSetCookie();const account=cookies.find(v=>v.startsWith('bopok_account='))!;
 expect(accountOf(request({},account.split(';')[0]))?.email).toBe('verified@example.org');expect(cookies.some(v=>v.startsWith('bopok_login_verifier=;')&&v.includes('Max-Age=0'))).toBe(true);
 expect(await result.text()).not.toContain('test-access');
});
it('expired or mismatched provider codes are rejected',async()=>{
 const provider=new AuthProvider('https://db.supabase.co','anon',async()=>new Response('',{status:400}));
 await expect(provider.exchange('expired','a'.repeat(43))).rejects.toThrow('Auth rejected');
});

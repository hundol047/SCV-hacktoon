import {beforeAll,afterAll,afterEach,beforeEach,it,expect,vi} from 'vitest';
import {database,rpc} from '../scripts/test-store.mjs';
import * as store from '../src/server/store';
import {reserveAI} from '../src/server/ai-budget';
import {ownerOf,anonymousOwner} from '../src/server/security';
let db:any;
beforeAll(async()=>{db=await database();},20000);afterAll(async()=>{await db.close();});
beforeEach(async()=>{await db.exec('delete from public.bopok_quotas');
 for(const [k,v] of Object.entries({BOPok_APP_URL:'https://travel.example',BOPok_REQUIRE_AUTH:'true',BOPok_AI_ALLOW_ANONYMOUS:'false',BOPok_SESSION_SECRET:'test-secret-of-at-least-thirty-two-characters',BOPok_AI_INPUT_USD_PER_MILLION:'10',BOPok_AI_OUTPUT_USD_PER_MILLION:'30',BOPok_AI_DAILY_USD_LIMIT:'1',BOPok_AI_DAILY_TOKEN_LIMIT:'200000',BOPok_AI_DAILY_REQUEST_LIMIT:'30'}))vi.stubEnv(k,v);
 vi.spyOn(store,'configuredRPC').mockReturnValue({call:(name,args)=>rpc(db,name,args)});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
const request=(cookie='',origin='https://travel.example')=>new Request('https://travel.example/api/courses',{headers:{cookie,origin}});
it('requires login by default; explicit AI preview does not grant anonymous storage access',async()=>{
 expect((await reserveAI(request())).allowed).toBe(false);
 vi.stubEnv('BOPok_AI_ALLOW_ANONYMOUS','true');const first=await reserveAI(request());expect(first.allowed).toBe(true);expect(first.cookie).toContain('HttpOnly');
 const next=request(first.cookie!.split(';')[0]);expect(anonymousOwner(next)).toBeTruthy();expect(ownerOf(next)).toBeNull();
 const second=await reserveAI(next);expect(second.allowed).toBe(true);expect(second.cookie).toBeUndefined();
});
it('anonymous browsers share the persistent global token limit',async()=>{
 vi.stubEnv('BOPok_AI_ALLOW_ANONYMOUS','true');vi.stubEnv('BOPok_AI_DAILY_TOKEN_LIMIT','19600');
 expect((await reserveAI(request())).allowed).toBe(true);expect((await reserveAI(request())).allowed).toBe(false);
});
it('anonymous browsers share the persistent cost limit and reject foreign origins',async()=>{
 vi.stubEnv('BOPok_AI_ALLOW_ANONYMOUS','true');vi.stubEnv('BOPok_AI_DAILY_USD_LIMIT','0.23');
 expect((await reserveAI(request('', 'https://foreign.example'))).allowed).toBe(false);
 expect((await reserveAI(request())).allowed).toBe(true);expect((await reserveAI(request())).allowed).toBe(false);
});

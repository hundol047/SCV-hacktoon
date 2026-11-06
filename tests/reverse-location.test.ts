import {test,expect,vi} from 'vitest';
import {reverseLocation,currentPointSchema} from '../src/server/reverse-location';
const point={latitude:37.4,longitude:127.1};
const rpc={call:vi.fn(async()=>({allowed:true}))};
test('address lookup preserves actual device coordinates',async()=>{
 const fetcher=vi.fn(async()=>Response.json({display_name:'경기도 성남시',lat:'37.41',lon:'127.11'}));
 const location=await reverseLocation(point,rpc as never,fetcher as typeof fetch);expect(location).toMatchObject({...point,address:'경기도 성남시'});
});
test('provider failure keeps usable coordinates',async()=>{expect(await reverseLocation(point,rpc as never,vi.fn(async()=>new Response('',{status:502})) as typeof fetch)).toMatchObject({...point,address:'현재 위치'});});
test('out of range location rejected',()=>{expect(currentPointSchema.safeParse({latitude:100,longitude:127}).success).toBe(false);});

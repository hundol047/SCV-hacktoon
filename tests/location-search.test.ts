import {it,expect,vi} from 'vitest';
import {searchLocation} from '../src/server/location-search';
import type {RPC} from '../src/server/store';
const row={place_id:1,name:'판교고등학교',display_name:'판교고등학교, 성남시, 경기도',lat:'37.39',lon:'127.09'};
it('searches school names and road addresses without restricting to tourism records and caches results',async()=>{
 let cached:unknown=null;const rpc:RPC={call:async(name,args)=>name==='bopok_geo_guard'?{allowed:true}:args.p_value?(cached=args.p_value):cached};
 const fetcher=vi.fn(async(_url:unknown)=>Response.json([row]));
 const result=await searchLocation('판교고등학교',rpc,fetcher);expect(result[0].name).toBe('판교고등학교');expect(result[0].latitude).toBe(37.39);
 const url=new URL(String(fetcher.mock.calls[0][0]));expect(url.searchParams.get('q')).toBe('판교고등학교');expect(url.searchParams.get('countrycodes')).toBe('kr');
 expect(await searchLocation('판교고등학교',rpc,fetcher)).toEqual(result);expect(fetcher).toHaveBeenCalledOnce();
});
it('preserves multiple candidates for explicit user choice and respects the shared rate guard',async()=>{
 const rpc:RPC={call:async(name)=>name==='bopok_geo_guard'?{allowed:true}:null};
 expect((await searchLocation('도로명주소 123',rpc,async()=>Response.json([row,{...row,place_id:2,display_name:'다른 학교, 다른 구',lat:'37.4'}]))).length).toBe(2);
 const fetcher=vi.fn();await expect(searchLocation('학교', {call:async(name)=>name==='bopok_geo_guard'?{allowed:false}:null},fetcher)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
});
it('returns zero matches without substituting a city center and reports provider failure',async()=>{
 const rpc:RPC={call:async(name)=>name==='bopok_geo_guard'?{allowed:true}:null};expect(await searchLocation('없는 주소',rpc,async()=>Response.json([]))).toEqual([]);
 await expect(searchLocation('주소',rpc,async()=>new Response('',{status:503}))).rejects.toThrow('PROVIDER');
});
import {locationQuery} from '../src/domain/location-query';
it('expands school abbreviations across names and normalizes road numbers',()=>{
 expect(locationQuery('판교고')).toBe('판교고등학교');expect(locationQuery('수원공고')).toBe('수원공업고등학교');expect(locationQuery('서울여고')).toBe('서울여자고등학교');expect(locationQuery('교보문고')).toBe('교보문고');expect(locationQuery('성남 분당중')).toBe('성남 분당중학교');expect(locationQuery('서울 대치초')).toBe('서울 대치초등학교');expect(locationQuery('서초')).toBe('서초');expect(locationQuery('판교역로235')).toBe('판교역로 235');expect(locationQuery('불정로77번길3')).toBe('불정로 77번길 3');
});
it('uses expanded school name and normalized road address for provider requests',async()=>{
 const rpc:RPC={call:async(name)=>name==='bopok_geo_guard'?{allowed:true}:null};const fetcher=vi.fn(async()=>Response.json([row]));
 await searchLocation('판교고',rpc,fetcher);expect(new URL(String((fetcher.mock.calls[0] as unknown[])[0])).searchParams.get('q')).toBe('판교고등학교');
 await searchLocation('성남시 판교역로235',rpc,fetcher);expect(new URL(String((fetcher.mock.calls[1] as unknown[])[0])).searchParams.get('q')).toBe('성남시 판교역로 235');
});

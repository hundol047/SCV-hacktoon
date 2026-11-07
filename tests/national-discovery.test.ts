import {expect,it} from 'vitest';
import {koreaRegions} from '../src/data/korea-tourism';
import {nationalDiscovery,startingSuggestions,winterLeisure} from '../src/data/national-discovery';
it('all 17 provinces have distinct starting suggestions',()=>{expect(Object.keys(nationalDiscovery).sort()).toEqual(koreaRegions.map(r=>r.code).sort());for(const r of koreaRegions){const names=startingSuggestions(r.code);expect(names.length).toBeGreaterThanOrEqual(8);expect(new Set(names).size).toBe(names.length);}});
it('arbitrary districts are queried rather than assigned another city suggestions',()=>{expect(startingSuggestions('KR-42','양구군')).toHaveLength(8);expect(startingSuggestions('KR-26','양구군')).toEqual([]);expect(startingSuggestions('KR-49','서귀포시')).toEqual([]);});
it('winter leisure is recognized outside Gangwon',()=>{for(const n of ['지산포레스트리조트','무주덕유산리조트','가평레일바이크','서울랜드 눈썰매장'])expect(winterLeisure(n)).toBe(true);expect(winterLeisure('경복궁')).toBe(false);});

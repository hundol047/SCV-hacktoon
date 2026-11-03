import {afterEach,it,expect,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {createId} from '../src/domain/id';
afterEach(()=>vi.unstubAllGlobals());
it('creates distinct RFC4122 v4 UUIDs without HTTPS-only randomUUID',()=>{
 vi.stubGlobal('crypto',{getRandomValues:webcrypto.getRandomValues.bind(webcrypto)});
 const ids=Array.from({length:100},createId);expect(new Set(ids).size).toBe(100);
 for(const id of ids)expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
it('uses native UUID when available',()=>{const randomUUID=vi.fn(()=> 'native-id');vi.stubGlobal('crypto',{randomUUID});expect(createId()).toBe('native-id');expect(randomUUID).toHaveBeenCalledOnce();});

import {it,expect,vi} from 'vitest';
import {fetchPlaceDetails} from '../src/server/place-details';
it('only uses requested public OSM objects and omits unsafe website links',async()=>{
 const fetcher=vi.fn(async(_url:unknown)=>Response.json({elements:[{type:'node',id:888881,tags:{phone:'033-123-1234',opening_hours:'Mo-Fr 09:00-18:00',website:'javascript:alert(1)'}},{type:'node',id:888882,tags:{phone:'not requested'}}]}));
 const result=await fetchPlaceDetails(['osm:node:888881'],fetcher);expect(result['osm:node:888881'].phone).toBe('033-123-1234');expect(result['osm:node:888881'].website).toBeUndefined();expect(result['osm:node:888882']).toBeUndefined();
 expect(String(fetcher.mock.calls[0][0])).toBe('https://www.openstreetmap.org/api/0.6/nodes.json?nodes=888881');
});
it('failed enrichment leaves empty results rather than fabricated values',async()=>{expect(await fetchPlaceDetails(['osm:way:888883'],async()=>{throw Error('offline');})).toEqual({});});

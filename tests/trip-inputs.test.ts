import {it,expect} from 'vitest';
import {defaultBasics,defaultConditions,basicsSchema} from '../src/domain/schema';
import {courseInput,regionalCourse} from '../src/domain/regional-course';
import {osmCatalog} from '../src/adapters/real-data';
import {koreaPlace} from '../src/data/korea-catalog';
import {catalogSchema} from '../src/data/catalog';
const catalog=osmCatalog('강릉',{elements:[1,2,3].map(id=>({type:'node',id,lat:37.75+id/100,lon:128.9,tags:{name:'장소'+id,tourism:'museum'}}))},new Date().toISOString());
it('departure coordinates influence first-day ranking and group size persists into vehicle plans',()=>{
 const basics=basicsSchema.parse({...defaultBasics,mode:'real',region:'강릉',transport:'taxi',days:1,departureRegion:'서울',departureCoordinates:{latitude:37.56,longitude:126.97},travelers:5});
 const input=courseInput(basics,defaultConditions,catalog,1),payload=JSON.parse(input.text);expect(payload.travelers).toBe(5);expect(payload.departureRegion).toBe('서울');expect(input.origin.longitude).toBe(126.97);
 const result=regionalCourse(basics,defaultConditions,catalog,1,{candidateIds:input.candidates.slice(0,2).map(p=>p.place.id)});expect(result.plan.travelers).toBe(5);expect(result.plan.vehicles).toBe(2);
 expect(basicsSchema.safeParse({...basics,travelers:21}).success).toBe(false);
});
it('preserves source address/contact/hours without making up absent fields',()=>{
 const snapshot={coverage:[{code:'KR-42',collectedAt:'2026-11-04T00:00:00Z'}]} as any;
 const record={id:'osm:node:1',name:'장소',category:'culture',provinces:['KR-42'],address:'강릉시 테스트길',latitude:37.7,longitude:128.9,tags:{opening_hours:'09:00-18:00','contact:phone':'033-000-0000',website:'https://example.org'}} as any;
 const place=koreaPlace(record,snapshot,'강릉');expect(place.visitorInfo).toMatchObject({address:record.address,hoursText:'09:00-18:00',phone:'033-000-0000'});expect(catalogSchema.parse({...catalog,places:[place]}).places[0].visitorInfo?.website).toBe('https://example.org');
 expect(koreaPlace({...record,tags:{},address:''},snapshot,'강릉').visitorInfo?.hoursText).toBeUndefined();expect(place.cost.value).toBeNull();
});

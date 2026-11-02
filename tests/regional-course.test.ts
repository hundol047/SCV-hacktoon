import {expect,it} from 'vitest';
import {osmCatalog} from '../src/adapters/real-data';
import {defaultBasics,defaultConditions} from '../src/domain/schema';
import {courseInput,regionalCourse} from '../src/domain/regional-course';
const catalog=osmCatalog('서울',{elements:[1,2,3].map(n=>({type:'node',id:n,lat:37.5+n/100,lon:127,tags:{name:`장소${n}`,tourism:n===1?'museum':'attraction'}}))},new Date().toISOString());
const b={...defaultBasics,mode:'real' as const,region:'서울',transport:'driving' as const,travelPriority:'balanced' as const};
it('지역 후보와 취향을 전달하고 선택을 검증한 뒤 자동차 코스를 만든다',()=>{
  const c={...defaultConditions,experiences:['문화·전시']};
  const input=courseInput(b,c,catalog,1);
  expect(input.candidates[0].place.name).toBe('장소1');
  expect(JSON.parse(input.text)).toMatchObject({region:'서울',transport:'driving',conditions:{experiences:['문화·전시']}});
  const result=regionalCourse(b,c,catalog,1,{candidateIds:input.candidates.map(p=>p.place.id)});
  expect(result.plan).toMatchObject({transport:'driving',day:1,estimatedFare:null});
  expect(result.places).toHaveLength(3);
});
it('없는 장소, 중복, 한 곳, 다른 지역, 여행일 밖의 추천을 거부한다',()=>{
  const ids=catalog.places.map(p=>p.id);
  for(const candidateIds of [[ids[0],'invented'],[ids[0],ids[0]],[ids[0]]])expect(()=>regionalCourse(b,defaultConditions,catalog,1,{candidateIds})).toThrow();
  expect(()=>courseInput({...b,region:'부산'},defaultConditions,catalog,1)).toThrow();
  expect(()=>courseInput(b,defaultConditions,catalog,31)).toThrow();
  expect(()=>courseInput({...b,travelDays:[1]},defaultConditions,catalog,1)).toThrow();
});

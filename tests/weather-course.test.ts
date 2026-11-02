import {expect,it} from 'vitest';
import {osmCatalog} from '../src/adapters/real-data';
import {defaultBasics,defaultConditions,basicsSchema,tripSchema} from '../src/domain/schema';
import {courseInput,regionalCourse} from '../src/domain/regional-course';
import {savePlan,removePlan,savedPlans} from '../src/domain/course-plans';
import {optimize} from '../src/domain/optimizer';
import {settingFromTags,weatherAllowed} from '../src/domain/weather';
import {placeSimilarity} from '../src/domain/place-similarity';
const catalog=osmCatalog('서울',{elements:[...Array.from({length:6},(_,i)=>({type:'node',id:i+1,lat:37.5,lon:127+i/100,tags:{name:`관광${i}`,tourism:'museum',indoor:i===0?'no':i===1?'yes':undefined}})),{type:'node',id:10,lat:37.5,lon:127.01,tags:{name:'식당',amenity:'restaurant',indoor:'yes'}}].map(e=>({...e,tags:Object.fromEntries(Object.entries(e.tags).filter(([,v])=>v!==undefined))}))},new Date().toISOString());
const b={...defaultBasics,mode:'real' as const,region:'서울',transport:'driving' as const,days:2,travelPriority:'budget' as const};
const c={...defaultConditions,restInterval:null};
it('출발 기준을 바꾸면 거리 우선 후보와 AI 입력 거리가 달라진다',()=>{
  const first=courseInput(b,c,catalog,1);
  const last=courseInput({...b,coursePreferences:[{day:1,weather:'unknown',visitMinutes:60,originId:catalog.places[5].id}]},c,catalog,1);
  expect(first.candidates[0].place.id).toBe(catalog.places[0].id);
  expect(last.candidates[0].place.id).toBe(catalog.places[5].id);
  expect(JSON.parse(last.text).candidates[0].distanceKm).toBe(0);
});
it('비는 실내 우선·야외 제외·미확인 표시, 특보는 추천 중단',()=>{
  const rainy={...b,coursePreferences:[{day:1,weather:'rain' as const,visitMinutes:60}]};
  const input=courseInput(rainy,c,catalog,1);
  expect(input.candidates[0].place.setting?.value).toBe('indoor');
  expect(input.candidates.some(p=>p.place.setting?.value==='outdoor')).toBe(false);
  const result=regionalCourse(rainy,c,catalog,1,{candidateIds:input.candidates.slice(0,3).map(p=>p.place.id)});
  expect(result.warnings.some(w=>w.includes('실내외 미확인'))).toBe(true);
  expect(()=>courseInput({...b,coursePreferences:[{day:1,weather:'storm',visitMinutes:60}]},c,catalog,1)).toThrow('중단');
  for(const weather of ['rain','snow','heat','cold'] as const)expect(weatherAllowed(catalog.places[0],weather)).toBe(false);
  expect(settingFromTags({tourism:'museum'})).toBe('unknown');
});
it('식사·휴식을 포함하고 날짜별 계획·고유 ID·백업을 보존한다',()=>{
  const one=regionalCourse(b,c,catalog,1,{candidateIds:catalog.places.slice(0,3).map(p=>p.id)});
  let saved=savePlan(b,one.plan);
  const two=regionalCourse(saved,c,catalog,2,{candidateIds:catalog.places.slice(3,6).map(p=>p.id)});
  saved=savePlan(saved,two.plan);
  expect(savedPlans(saved)).toHaveLength(2);
  expect(basicsSchema.safeParse(saved).success).toBe(true);
  const result=optimize(c,saved,[],[],catalog);
  expect(result.blocked).toBe(false);
  for(const day of [1,2]){expect(result.items.filter(i=>i.day===day&&i.kind==='meal')).toHaveLength(1);expect(result.items.filter(i=>i.day===day&&i.kind==='rest')).toHaveLength(3);}
  expect(new Set(result.items.map(i=>i.id)).size).toBe(result.items.length);
  const backup=tripSchema.parse(JSON.parse(JSON.stringify({version:1,id:'multi',revision:0,basics:saved,conditions:c,catalog,items:result.items,history:[],feedback:[]})));
  expect(backup.basics.coursePlans).toHaveLength(2);
  expect(savedPlans(removePlan(saved,2)).map(p=>p.day)).toEqual([1]);
  expect(courseInput(saved,c,catalog,1).candidates.some(p=>two.plan.selectedPlaceIds.includes(p.place.id))).toBe(false);
});
it('유사도는 공통 특성에 근거하며 정보 부족을 유사하다고 표시하지 않는다',()=>{
  expect(placeSimilarity(catalog.places[1],catalog.places[2]).reasons).toContain('공통 테마: 문화·전시');
  const noTraits={...catalog.places[3],experiences:[],setting:undefined};
  expect(placeSimilarity(noTraits,noTraits)).toEqual({score:0,reasons:['공통 특성 자료 부족 · 조건에 맞는 대안']});
});

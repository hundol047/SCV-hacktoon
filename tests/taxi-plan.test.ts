import { describe, expect, it } from 'vitest';
import type { Place } from '../src/data/demo';
import { basicsSchema, taxiPlanSchema, itemSchema, defaultBasics, defaultConditions } from '../src/domain/schema';
import { haversineKm, optimizeTaxiOrder, taxiPlanSummary } from '../src/domain/taxi-plan';
import { optimize } from '../src/domain/optimizer';

const place = (id: string, latitude: number, longitude: number): Place => ({
  id, name: id, kind: 'visit', experiences: [], description: '', latitude, longitude,
  walkMin: { value: 1, evidenceId: id, source: 'https://example.com', nature: 'real', checked: 'source', collectedAt: new Date().toISOString() },
  walkM: { value: 10, evidenceId: id, source: 'https://example.com', nature: 'real', checked: 'source', collectedAt: new Date().toISOString() },
  stairs: { value: false, evidenceId: id, source: 'https://example.com', nature: 'real', checked: 'source', collectedAt: new Date().toISOString() },
  seat: { value: true, evidenceId: id, source: 'https://example.com', nature: 'real', checked: 'source', collectedAt: new Date().toISOString() },
  foods: { value: [], evidenceId: id, source: 'https://example.com', nature: 'real', checked: 'source', collectedAt: new Date().toISOString() },
  cost: { value: null, evidenceId: id, source: 'https://example.com', nature: 'real', checked: 'source', collectedAt: new Date().toISOString() },
  hours: { value: null, evidenceId: id, source: 'https://example.com', nature: 'real', checked: 'source', collectedAt: new Date().toISOString() },
  situations: { value: [], evidenceId: id, source: 'https://example.com', nature: 'real', checked: 'source', collectedAt: new Date().toISOString() },
});

describe('학생 택시 순서 계산', () => {
  const points = [place('a',37,127),place('b',37,127.01),place('c',37,127.02)];
  const planFor = (options: Parameters<typeof optimizeTaxiOrder>[7] = {}) => {
    const result=optimizeTaxiOrder(points,['a','c','b'],'a',5,4800,0,new Date().toISOString(),options);
    if('error' in result) throw new Error(result.error);
    return result.plan;
  };
  const catalog={mode:'real' as const,region:'서울',places:points,routes:[],sourceNotice:'test',collectedAt:new Date().toISOString()};
  it('기본요금을 구간과 차량 수만큼 계산하고 복귀 이동도 포함한다',()=>{
    expect(planFor().estimatedFare).toBe(4800*2*2);
    expect(planFor({returnToStart:true}).estimatedFare).toBe(4800*3*2);
    expect(planFor({taxiCapacity:6}).vehicles).toBe(1);
    expect(planFor({returnToStart:true}).distanceKm).toBeGreaterThan(planFor().distanceKm);
  });
  it('마지막 목적지를 고정하고 서로 모순된 종점을 거부한다',()=>{
    expect(planFor({endPlaceId:'b'}).orderedPlaceIds).toEqual(['a','c','b']);
    expect(optimizeTaxiOrder(points,['a','b'],'a',1,null,null,undefined,{endPlaceId:'b',returnToStart:true})).toHaveProperty('error');
  });
  it('잘못된 숫자·좌표·정원을 예외 대신 입력 오류로 반환한다',()=>{
    for(const fare of [-1,NaN,Infinity,0.5,100001]) expect(optimizeTaxiOrder(points,['a','b'],'a',1,fare,1000)).toHaveProperty('error');
    expect(optimizeTaxiOrder(points,['a','b'],'a',1,null,null,undefined,{taxiCapacity:0})).toHaveProperty('error');
    expect(haversineKm({latitude:NaN,longitude:127},points[0])).toBeNull();
    expect(haversineKm({latitude:0,longitude:0},{latitude:0,longitude:180})).toBeCloseTo(Math.PI*6371);
  });
  it('다른 이동 수단, 기간 밖 날짜, 변조된 출발지와 요금을 저장하지 않는다',()=>{
    const taxiPlan=planFor();
    expect(taxiPlanSchema.safeParse({...taxiPlan,startPlaceId:'b'}).success).toBe(false);
    expect(taxiPlanSchema.safeParse({...taxiPlan,estimatedFare:1}).success).toBe(false);
    expect(basicsSchema.safeParse({...defaultBasics,mode:'real',region:'서울',transport:'walk',taxiPlan}).success).toBe(false);
    expect(basicsSchema.safeParse({...defaultBasics,mode:'real',region:'서울',days:1,taxiPlan:{...taxiPlan,day:2}}).success).toBe(false);
  });
  it('일정은 지정한 날짜에 복귀까지 배치하고 다른 날짜를 보존한다',()=>{
    const b={...defaultBasics,mode:'real' as const,region:'서울',taxiPlan:planFor({day:2,returnToStart:true})};
    const original=[{id:'fixed-other-day',day:1,start:600,end:630,kind:'visit' as const,placeId:'a',fromId:null,toId:null,transport:null,locked:true,mode:'real' as const}];
    const result=optimize(defaultConditions,b,original,[],catalog);
    expect(result.items).toContainEqual(original[0]);
    expect(result.items.find(i=>i.id==='taxi-plan:return')).toMatchObject({day:2,toId:'a'});
    expect(result.items.every(i=>itemSchema.safeParse(i).success)).toBe(true);
  });
  it('고정 일정과 시간 초과는 기존 일정을 보존하고 부분 생성하지 않는다',()=>{
    const b={...defaultBasics,days:1,mode:'real' as const,region:'서울',taxiPlan:planFor()};
    const initial=optimize(defaultConditions,b,[],[],catalog).items;
    const locked=initial.map((i,n)=>({...i,locked:n===0}));
    expect(optimize(defaultConditions,b,locked,[],catalog)).toMatchObject({blocked:true,items:locked});
    const many=Array.from({length:20},(_,i)=>place(`p${i}`,37,127+i/100));
    const result=optimizeTaxiOrder(many,many.map(p=>p.id),'p0',1,null,null);
    if('error' in result)throw new Error(result.error);
    const overflow=optimize(defaultConditions,{...b,taxiPlan:result.plan},[],[],{...catalog,places:many});
    expect(overflow.blocked).toBe(true);expect(overflow.items).toEqual([]);expect(overflow.reasons.join()).toContain('하루');
  });
  it('좌표 거리를 계산하고 출발지를 고정한다', () => {
    const points = [place('a', 37, 127), place('b', 37, 127.01), place('c', 37, 127.02)];
    expect(haversineKm(points[0], points[1])).toBeGreaterThan(0.8);
    const result = optimizeTaxiOrder(points, ['a', 'b', 'c'], 'a', 5, 4800, 1000);
    expect('plan' in result).toBe(true);
    if ('plan' in result) {
      expect(result.plan.orderedPlaceIds[0]).toBe('a');
      expect(result.plan.vehicles).toBe(2);
      expect(result.plan.estimatedFare).toBeGreaterThan(0);
      expect(taxiPlanSummary(result.plan)).toContain('예상 총액');
    }
  });
  it('요금 가정 없이도 순서만 저장한다', () => {
    const result = optimizeTaxiOrder([place('a', 37, 127), place('b', 37, 127.01)], ['a', 'b'], 'a', 1, null, null);
    expect('plan' in result && result.plan.estimatedFare).toBeNull();
  });
  it('좌표가 없거나 장소가 부족하면 계산하지 않는다', () => {
    expect(optimizeTaxiOrder([place('a', 37, 127)], ['a'], 'a', 1, null, null)).toEqual({ error: '장소를 2~20곳 선택해 주세요.' });
    expect(optimizeTaxiOrder([place('a', 37, 127), place('b', 37, 127.01)], ['a', 'b'], 'a', 1, 4800, null)).toEqual({ error: '요금 가정은 기본요금과 km당 요금을 함께 입력해 주세요.' });
  });
  it('기존 기본값은 택시 계획 없이도 계속 유효하다', () => {
    expect(basicsSchema.safeParse({ title: 't', region: '서울', date: '2026-01-01', days: 1, budget: 0, transport: 'taxi', mode: 'real', timezone: 'Asia/Seoul' }).success).toBe(true);
  });
  it('일정 생성기가 저장된 순서를 1일차 이동으로 연결한다', () => {
    const points = [place('a', 37, 127), place('b', 37, 127.01), place('c', 37, 127.02)];
    const planned = optimizeTaxiOrder(points, ['a', 'b', 'c'], 'a', 3, null, null);
    if ('error' in planned) throw new Error(planned.error);
    const catalog = { mode: 'real' as const, region: '서울', places: points, routes: [], sourceNotice: 'test', collectedAt: new Date().toISOString() };
    const basics = { ...defaultBasics, mode: 'real' as const, region: '서울', taxiPlan: planned.plan };
    const result = optimize(defaultConditions, basics, [], [], catalog);
    expect(result.items.filter(item => item.kind === 'move').map(item => item.toId)).toEqual(['b', 'c']);
    expect(result.reasons.join(' ')).toContain('실제 도로 경로');
  });
});

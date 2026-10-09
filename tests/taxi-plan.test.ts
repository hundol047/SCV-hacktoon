import { describe, expect, it } from 'vitest';
import type { Place } from '../src/data/demo';
import { basicsSchema, defaultBasics, defaultConditions } from '../src/domain/schema';
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

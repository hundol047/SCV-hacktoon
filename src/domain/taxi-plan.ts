import type { Place } from '../data/demo';
import { taxiPlanSchema, type TaxiPlan } from './schema';

export type TaxiOrderResult = { plan: TaxiPlan; places: Place[] };

export function haversineKm(a: Pick<Place, 'latitude' | 'longitude'>, b: Pick<Place, 'latitude' | 'longitude'>): number | null {
  if (a.latitude === undefined || a.longitude === undefined || b.latitude === undefined || b.longitude === undefined) return null;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const lat1 = a.latitude * rad;
  const lat2 = b.latitude * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function routeDistance(ids: string[], byId: Map<string, Place>): number | null {
  let total = 0;
  for (let i = 1; i < ids.length; i++) {
    const distance = haversineKm(byId.get(ids[i - 1])!, byId.get(ids[i])!);
    if (distance === null) return null;
    total += distance;
  }
  return total;
}

export function optimizeTaxiOrder(
  places: Place[], selectedPlaceIds: string[], startPlaceId: string, travelers: number,
  baseFare: number | null, perKmFare: number | null, createdAt = new Date().toISOString(),
): TaxiOrderResult | { error: string } {
  const ids = [...new Set(selectedPlaceIds)];
  if (ids.length < 2 || ids.length > 20) return { error: '장소를 2~20곳 선택해 주세요.' };
  if (!ids.includes(startPlaceId)) return { error: '출발 장소를 선택 목록에서 골라 주세요.' };
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 20) return { error: '여행 인원은 1~20명으로 입력해 주세요.' };
  if ((baseFare === null) !== (perKmFare === null)) return { error: '요금 가정은 기본요금과 km당 요금을 함께 입력해 주세요.' };
  const byId = new Map(places.map(place => [place.id, place]));
  if (ids.some(id => !byId.has(id))) return { error: '선택한 장소를 현재 자료에서 찾을 수 없습니다.' };
  if (ids.some(id => byId.get(id)?.latitude === undefined || byId.get(id)?.longitude === undefined)) return { error: '좌표가 확인된 장소만 순서를 계산할 수 있습니다.' };

  const remaining = new Set(ids.filter(id => id !== startPlaceId));
  const ordered = [startPlaceId];
  while (remaining.size) {
    const current = byId.get(ordered[ordered.length - 1])!;
    const next = [...remaining].sort((a, b) => {
      const da = haversineKm(current, byId.get(a)!);
      const db = haversineKm(current, byId.get(b)!);
      return (da ?? Number.POSITIVE_INFINITY) - (db ?? Number.POSITIVE_INFINITY) || a.localeCompare(b);
    })[0];
    ordered.push(next);
    remaining.delete(next);
  }
  // A small 2-opt pass removes common criss-crosses without an opaque solver.
  let improved = true;
  while (improved) {
    improved = false;
    const currentDistance = routeDistance(ordered, byId)!;
    for (let i = 1; i < ordered.length - 2 && !improved; i++) for (let j = i + 1; j < ordered.length - 1; j++) {
      const candidate = [...ordered.slice(0, i), ...ordered.slice(i, j + 1).reverse(), ...ordered.slice(j + 1)];
      const distance = routeDistance(candidate, byId)!;
      if (distance + 0.001 < currentDistance) { ordered.splice(0, ordered.length, ...candidate); improved = true; break; }
    }
  }
  const distanceKm = routeDistance(ordered, byId)!;
  const taxiCapacity = 4;
  const vehicles = Math.ceil(travelers / taxiCapacity);
  const estimatedFare = baseFare === null || perKmFare === null ? null : Math.ceil((baseFare + distanceKm * perKmFare) * vehicles);
  const plan = taxiPlanSchema.parse({ selectedPlaceIds: ids, orderedPlaceIds: ordered, startPlaceId, travelers, taxiCapacity, baseFare, perKmFare, vehicles, distanceKm, estimatedFare, createdAt });
  return { plan, places: ordered.map(id => byId.get(id)!) };
}

export function taxiPlanSummary(plan: TaxiPlan): string {
  const distance = `${plan.distanceKm.toFixed(1)}km(좌표 직선거리)`;
  if (plan.estimatedFare === null) return `${distance} · 실제 도로 거리·택시요금은 출발 전 확인 필요`;
  return `${distance} · 입력 가정 기준 예상 총액 ${plan.estimatedFare.toLocaleString()}원 · 1인 약 ${Math.ceil(plan.estimatedFare / plan.travelers).toLocaleString()}원`;
}

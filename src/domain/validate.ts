import { Conditions, Item, Basics, time } from "./schema";
import { Catalog,catalogFor,indexCatalog } from '../data/catalog';
import {destinationFor,convertMoney,localInstant,money,isTravelOnlyDay,transferForTransition} from './world';
import {dayDate} from './schema';
import {isReviewed} from './verification';
export type Issue = {
  code: string;
  status: "violation" | "unknown" | "conflict";
  itemIds: string[];
  message: string;
  evidenceIds: string[];
};
export type Report = {
  status: "pass" | "violation" | "unknown" | "conflict";
  issues: Issue[];
  cost: number;
};
export function validateSchedule(
  items: Item[],
  c: Conditions,
  b: Basics,
  suppliedCatalog?: Catalog,
): Report {
  const catalog=catalogFor(b.mode,suppliedCatalog);
  const {placeById,getRoute}=indexCatalog(catalog);
  const issues: Issue[] = [];
  const add = (
    code: string,
    status: Issue["status"],
    ids: string[],
    message: string,
    evidenceIds: string[] = [],
  ) => issues.push({ code, status, itemIds: ids, message, evidenceIds });
  if (!items.length&&!Array.from({length:b.days},(_,i)=>isTravelOnlyDay(b,i+1)).some(Boolean))
    add(
      "empty",
      "conflict",
      [],
      "현재 일정이 없습니다. 가능한 후보를 선택해 주세요.",
    );
  for (const [key, label] of [
    ["maxWalkMin", "걷기 시간"],
    ["maxWalkM", "걷기 거리"],
    ["restInterval", "휴식 간격"],
    ["restMin", "쉬는 시간"],
  ] as const) {
    if (c[key] === null)
      add(
        "condition:" + key,
        "unknown",
        [],
        `${label} 조건을 모릅니다. 확인되지 않은 조건은 충족으로 판정하지 않습니다.`,
      );
  }
  if (c.avoidSituations.length)
    add(
      "situations",
      "unknown",
      [],
      `피하고 싶은 상황(${c.avoidSituations.join(", ")})은 후보에 기록된 정보 범위만 확인할 수 있습니다.`,
    );
  let cost = 0;
  const price=(amount:number|null,currency:string|undefined,id:string)=>{if(amount===null)return 0;const converted=convertMoney(amount,currency??'KRW',b.currency??'KRW',catalog);if(converted===null){add('exchange-rate','unknown',[id],'해당 통화의 최신 환율이 없어 전체 예산을 판정할 수 없습니다.');return 0;}return converted;};
  for(const expense of b.expenses??[]){if(expense.amount===null)add('expense-unknown','unknown',[],'추가 비용 '+expense.label+' 금액을 확인해 주세요.');else cost+=price(expense.amount,expense.currency,expense.label);}
  if(b.mode==='real'&&b.days>1&&!b.expenses?.some(e=>e.category==='lodging'))add('lodging-cost','unknown',[],'숙박 비용이 기록되지 않아 전체 여행 예산은 미확인입니다. 숙박 비용이 없으면 0으로 기록해 주세요.');
  if((b.destinations?.length??0)>1&&!b.expenses?.some(e=>e.category==='intercity'))add('intercity-cost','unknown',[],'도시 간 교통 비용을 추가 비용에 기록해 주세요.');
  const transfers=b.transfers??[];for(const transfer of transfers){if(Date.parse(transfer.arrival)<=Date.parse(transfer.departure))add('transfer-time','violation',[],'도시 간 도착 시각은 출발 시각보다 늦어야 합니다.');add('transfer-evidence','unknown',[],'도시 간 '+transfer.fromRegion+' → '+transfer.toRegion+' 이동은 사용자 시간표 기록입니다. 운행·예약 상태를 출발 전에 확인해 주세요.');}
  for(let day=2;day<=b.days;day++){const before=destinationFor(b,day-1),after=destinationFor(b,day);if(before&&after&&before.region!==after.region){try{const match=transferForTransition(b,day),transfer=match.transfer;if(!transfer)add('intercity-transfer','unknown',[],match.ambiguous?'같은 도시 구간의 이동 기록이 여러 개입니다. 도착 여행일을 지정해 주세요.':day+'일차 도시를 바꾸는 이동 시간표가 없습니다.');}catch{add('timezone-ambiguous','unknown',[],'일광절약시간 전환일의 현지 시각을 확인해 주세요.');}}}
  if(transfers.length)for(const i of items){try{const timezone=destinationFor(b,i.day)?.timezone??b.timezone,start=Date.parse(localInstant(dayDate(b,i.day),i.start,timezone)),end=Date.parse(localInstant(dayDate(b,i.day),i.end,timezone));if(transfers.some(t=>Date.parse(t.arrival)>Date.parse(t.departure)&&start<Date.parse(t.arrival)&&end>Date.parse(t.departure)))add('intercity-overlap','violation',[i.id],'도시 간 이동 시각과 현지 일정이 겹칩니다.');}catch{add('timezone-ambiguous','unknown',[i.id],'현지 시각의 시간대 오프셋을 확인해 주세요.');}}
  const ids = new Set<string>();
  for (let day = 1; day <= b.days; day++) {
    const rows = items
      .filter((i) => i.day === day)
      .sort((a, b) => a.start - b.start);
    let walkMin = 0,
      walkM = 0,
      walkIds: string[] = [],
      walkEvidence: string[] = [],
      activeStart: number | null = null,
      lastPlace: string | null = null,
      unconfirmedRest = false;
    const travelOnly=isTravelOnlyDay(b,day);
    if(b.travelDays?.includes(day)&&!travelOnly)add('travel-day-evidence','unknown',[],day+'일차 이동 기록의 시각을 확인해 주세요.');
    if (!rows.length&&!travelOnly)
      add("empty-day", "conflict", [], `${day}일차 일정이 없습니다.`);
    for (let n = 0; n < rows.length; n++) {
      const i = rows[n],
        p = i.placeId ? placeById.get(i.placeId) : undefined;
      if (ids.has(i.id))
        add("duplicate", "violation", [i.id], "중복된 일정 ID가 있습니다.");
      ids.add(i.id);
      if (i.mode !== b.mode)
        add(
          "mixed",
          "conflict",
          [i.id],
          "실데이터와 가상 데이터를 섞을 수 없습니다.",
        );
      if (i.end <= i.start)
        add(
          "time",
          "violation",
          [i.id],
          "종료 시간은 시작 시간보다 늦어야 합니다.",
        );
      if (n && i.start < rows[n - 1].end)
        add(
          "overlap",
          "violation",
          [rows[n - 1].id, i.id],
          "일정 시간이 겹칩니다.",
        );
      if (activeStart === null) activeStart = i.start;
      let wm: number | null = 0,
        meters: number | null = 0,
        evidence: string[] = [];
      if (i.kind === "move") {
        let departure:string|undefined;try{if(i.transport==='transit')departure=localInstant(dayDate(b,day),i.start,destinationFor(b,day)?.timezone??b.timezone);}catch{add('timezone-ambiguous','unknown',[i.id],'대중교통 출발 시각의 시간대 오프셋을 확인해 주세요.');}const r = i.transport==='transit'&&!departure?undefined:getRoute(i.fromId, i.toId, i.transport,departure);
        if (c.avoidStairs && r) {
          if (r.stairs.value === true)
            add(
              "route-stairs",
              "violation",
              [i.id],
              "계단이 포함된 가상 이동 경로예요.",
              [r.stairs.evidenceId],
            );
          if (r.stairs.value === null)
            add(
              "route-stairs",
              "unknown",
              [i.id],
              "이동 경로의 계단 정보가 확인되지 않았어요.",
              [r.stairs.evidenceId],
            );
        }
        if (!r || r.duration.value === null) {
          add(
            "route",
            "unknown",
            [i.id],
            "이동 경로·시간 정보가 없습니다. 0분으로 처리하지 않았습니다.",
          );
          wm = null;
          meters = null;
        } else {
          if(b.mode==='real'&&(!r.duration.collectedAt||Date.now()-Date.parse(r.duration.collectedAt)>86400000))add('stale-route','unknown',[i.id],'경로 수집 후 하루 이상 지났거나 수집 시각이 없습니다. 출발 전에 다시 조회해 주세요.',[r.duration.evidenceId]);
          wm = r.walkMin.value;
          meters = r.walkM.value;
          evidence = [r.walkMin.evidenceId, r.walkM.evidenceId];
          cost += price(r.cost.value,placeById.get(r.fromId)?.currency,i.id);
          if(b.mode==='real'&&r.cost.value===null)add('cost-unknown','unknown',[i.id],'이동 비용은 미확인입니다. 예산 충족을 판정할 수 없습니다.',[r.cost.evidenceId]);
          if (i.end - i.start < r.duration.value)
            add(
              "travel-time",
              "violation",
              [i.id],
              `이동에 ${r.duration.value}분이 필요한데 ${i.end - i.start}분만 배정했어요.`,
              [r.duration.evidenceId],
            );
          if (lastPlace && i.fromId !== lastPlace)
            add(
              "route-origin",
              "violation",
              [i.id],
              "이동 출발지가 직전 장소와 다릅니다.",
            );
          lastPlace = i.toId;
        }
      } else if (!p) {
        add("place", "unknown", [i.id], "장소가 확인되지 않았습니다.");
        wm = null;
        meters = null;
      } else {
        const destination=destinationFor(b,day);if(destination&&p.region&&p.region!==destination.region)add('wrong-city','violation',[i.id],'이 날짜에 지정한 도시 밖의 장소입니다.');
        if (p.kind !== i.kind && i.kind !== "rest")
          add(
            "place-kind",
            "violation",
            [i.id],
            "장소 종류와 일정 종류가 다릅니다.",
          );
        if (lastPlace && lastPlace !== p.id)
          add(
            "missing-transfer",
            "unknown",
            [i.id],
            "장소 사이 이동 구간이 빠졌습니다. 이동 시간을 확인해 주세요.",
          );
        lastPlace = p.id;
        if (i.kind !== "rest") {
          wm = p.walkMin.value;
          meters = p.walkM.value;
          evidence = [p.walkMin.evidenceId, p.walkM.evidenceId];
          cost += price(p.cost.value,p.currency,i.id);
        }
        if (
          p.hours.value &&
          (i.start < p.hours.value[0] || i.end > p.hours.value[1])
        )
          add("hours", "violation", [i.id], "자료에 기록된 운영 시간을 벗어납니다.", [
            p.hours.evidenceId,
          ]);
        if (c.avoidStairs) {
          if (p.stairs.value === true)
            add(
              "stairs",
              "violation",
              [i.id],
              "계단을 피하고 싶다는 조건과 맞지 않는 장소예요.",
              [p.stairs.evidenceId],
            );
          if (p.stairs.value === null)
            add(
              "stairs",
              "unknown",
              [i.id],
              "계단 정보가 확인되지 않은 장소예요.",
              [p.stairs.evidenceId],
            );
        }
        if(b.mode==='real'){
          if(p.hours.value===null)add('hours-unknown','unknown',[i.id],'운영 시간·휴무일을 확인해 주세요.',[p.hours.evidenceId]);
          if(p.cost.value===null)add('cost-unknown','unknown',[i.id],'이 항목 비용은 미확인입니다. 예산 충족을 판정할 수 없습니다.',[p.cost.evidenceId]);
          const facts=[p.walkMin,p.walkM,p.stairs,p.seat,p.foods,p.cost,p.hours,p.situations];
          if(!isReviewed(p)&&facts.some(f=>f.value!==null&&f.checked==='source'))add('source-review','unknown',[i.id],'출처에 등록된 시설 정보는 독립 검토 전입니다. 현지 상태를 확인해 주세요.');
          if(!isReviewed(p)&&facts.some(f=>f.checked==='user'))add('user-evidence','unknown',[i.id],'사용자가 기록한 시설·메뉴 정보입니다. 서비스가 독립적으로 검증하지 않았으니 출발 전에 다시 확인해 주세요.',facts.filter(f=>f.checked==='user').map(f=>f.evidenceId));
          if(p.review&&!isReviewed(p))add('review-invalid','unknown',[i.id],'독립 검토 서명을 확인하지 못했습니다. 기록을 다시 조회해 주세요.');
          if(!catalog.collectedAt||Date.now()-Date.parse(catalog.collectedAt)>7*86400000||facts.some(f=>f.value!==null&&(!f.collectedAt||Date.now()-Date.parse(f.collectedAt)>7*86400000)))add('stale-data','unknown',[i.id],'자료 수집 후 7일 이상 지났거나 수집 시각이 없습니다. 최신 정보 확인이 필요합니다.');
        }
        if (c.avoidSituations.some((v) => p.situations.value?.includes(v)))
          add(
            "avoid-situation",
            "violation",
            [i.id],
            "피하고 싶은 상황이 기록된 장소예요.",
            [p.situations.evidenceId],
          );
        if (i.kind === "meal") {
          if(c.foodLikes.length&&!c.foodLikes.some(f=>p.foods.value?.includes(f)))add('food-preference','unknown',[i.id],`선호 음식(${c.foodLikes.join(', ')})의 메뉴 제공 여부를 확인해 주세요.`,[p.foods.evidenceId]);
          if (p.foods.value === null)
            add(
              "food",
              "unknown",
              [i.id],
              "식성에 맞는 메뉴 정보가 없습니다.",
              [p.foods.evidenceId],
            );
          else {
            if (c.foodAvoids.some((v) => p.foods.value!.includes(v)))
              add(
                "food",
                "violation",
                [i.id],
                `피하고 싶은 음식(${c.foodAvoids.join(", ")})이 있어요.`,
                [p.foods.evidenceId],
              );
            if (
              c.foodAvoids.some(
                (v) =>
                  !["매운 음식", "순한 음식", "지역 음식", "죽"].includes(v),
              )
            )
              add(
                "food-unknown",
                "unknown",
                [i.id],
                "입력하신 회피 음식의 포함 여부가 메뉴 자료에 없습니다.",
                [p.foods.evidenceId],
              );
          }
          if (c.latestLunch !== null && i.start > c.latestLunch)
            add(
              "lunch",
              "violation",
              [i.id],
              `점심이 ${time(c.latestLunch)}보다 늦어요.`,
            );
        }
        if (wm !== null && wm > i.end - i.start)
          add(
            "internal-time",
            "violation",
            [i.id],
            "장소 내부 보행 시간보다 머무는 시간이 짧아요.",
            [p.walkMin.evidenceId],
          );
      }
      if (wm === null || meters === null)
        add(
          "walking-data",
          "unknown",
          [i.id],
          "보행 시간 또는 거리 정보가 부족합니다.",
          evidence,
        );
      if ((wm !== null && wm > 0) || (meters !== null && meters > 0)) {
        walkMin += wm ?? 0;
        walkM += meters ?? 0;
        walkIds.push(i.id);
        walkEvidence.push(...evidence);
      }
      if (c.maxWalkMin !== null && walkMin > c.maxWalkMin)
        add(
          "walk-time",
          "violation",
          [...walkIds],
          `연속 보행 ${walkMin}분: 한 번에 ${c.maxWalkMin}분 조건을 넘었어요.`,
          [...walkEvidence],
        );
      if (c.maxWalkM !== null && walkM > c.maxWalkM)
        add(
          "walk-distance",
          "violation",
          [...walkIds],
          `연속 보행 ${walkM}m: 한 번에 ${c.maxWalkM}m 조건을 넘었어요.`,
          [...walkEvidence],
        );
      const validRest =
        i.kind === "rest" &&
        p?.seat.value === true &&
        c.restMin !== null &&
        i.end - i.start >= c.restMin;
      if (i.kind === "rest" && p?.seat.value === null) unconfirmedRest = true;
      if (i.kind === "rest" && p?.seat.value !== true)
        add(
          "seat",
          "unknown",
          [i.id],
          "실제로 앉아 쉴 수 있는지 확인이 필요해요.",
          p ? [p.seat.evidenceId] : [],
        );
      if (
        i.kind === "rest" &&
        c.restMin !== null &&
        i.end - i.start < c.restMin
      )
        add(
          "short-rest",
          "violation",
          [i.id],
          `${c.restMin}분보다 짧은 휴식은 연속 보행을 초기화하지 않습니다.`,
        );
      if (
        c.restInterval !== null &&
        activeStart !== null &&
        (validRest ? i.start : i.end) - activeStart > c.restInterval
      )
        add(
          "rest-interval",
          unconfirmedRest ? "unknown" : "violation",
          [i.id],
          unconfirmedRest ? `앉을 자리가 미확인이라 ${c.restInterval}분 안에 충분히 쉬는지 확인이 필요합니다.` : `${c.restInterval}분 안에 충분히 쉬고 싶다는 조건을 넘었어요.`,
        );
      if (validRest) {
        unconfirmedRest = false;
        walkMin = 0;
        walkM = 0;
        walkIds = [];
        walkEvidence = [];
        activeStart = i.end;
      }
    }
    if (!travelOnly&&!rows.some((i) => i.kind === "meal"))
      add("meal-missing", "unknown", [], `${day}일차 식사 일정이 없습니다.`);
  }
  for (const i of items)
    if (i.day > b.days)
      add("day", "violation", [i.id], "여행 기간 밖의 일정이 있습니다.");
  for (const e of c.requiredExperiences)
    if (
      !items.some(
        (i) =>
          i.kind !== "move" &&
          i.kind !== "rest" &&
          placeById.get(i.placeId ?? "")?.experiences.includes(e),
      )
    )
      add(
        "required-experience",
        "conflict",
        [],
        `꼭 하고 싶은 경험 “${e}”을 현재 후보로 충족하지 못했습니다.`,
      );
  if (cost > b.budget)
    add(
      "budget",
      "violation",
      [],
      `확인된 비용 ${money(cost,b.currency)}이 전체 예산을 넘어요.`,
    );
  return {
    status: issues.some((x) => x.status === "conflict")
      ? "conflict"
      : issues.some((x) => x.status === "violation")
        ? "violation"
        : issues.length
          ? "unknown"
          : "pass",
    issues,
    cost,
  };
}

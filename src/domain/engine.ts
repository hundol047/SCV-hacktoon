import { Basics, Conditions, Item, Trip } from "./schema";
import { places, placeById, getRoute, Place } from "../data/demo";
import { validateSchedule } from "./validate";

const make = (
  day: number,
  n: number,
  start: number,
  end: number,
  kind: Item["kind"],
  placeId: string | null,
  other: Partial<Item> = {},
): Item => ({
  id: `d${day}-${n}`,
  day,
  start,
  end,
  kind,
  placeId,
  fromId: null,
  toId: null,
  transport: null,
  locked: false,
  mode: "demo",
  ...other,
});
export function demoItinerary(b: Basics): Item[] {
  return Array.from({ length: b.days }, (_, idx) => {
    const day = idx + 1;
    return [
      make(day, 0, 570, 582, "move", null, {
        fromId: "p04",
        toId: "p01",
        transport: "walk",
      }),
      make(day, 1, 582, 627, "visit", "p01"),
      make(day, 2, 627, 632, "rest", "p01"),
      make(day, 3, 632, 650, "move", null, {
        fromId: "p01",
        toId: "p16",
        transport: "walk",
      }),
      make(day, 4, 855, 905, "meal", "p16"),
      make(day, 5, 905, 915, "rest", "p16"),
    ];
  }).flat();
}
export type Proposal = {
  items: Item[];
  reasons: string[];
  preserved: string[];
  blocked: boolean;
};
export function generate(
  c: Conditions,
  b: Basics,
  original: Item[] = [],
  feedback: string[] = [],
): Proposal {
  if (original.some((i) => i.locked)) {
    const report = validateSchedule(original, c, b);
    return {
      items: structuredClone(original),
      reasons: [
        "고정 일정은 보존했습니다. 이 MVP는 고정 시간 주변의 재배치를 자동으로 수행하지 않습니다. 직접 편집 후 재점검해 주세요.",
      ],
      preserved: [],
      blocked: report.status === "violation" || report.status === "conflict",
    };
  }
  const eligible = (p: Place) =>
    p.walkMin.value !== null &&
    p.walkM.value !== null &&
    (c.maxWalkMin === null || p.walkMin.value <= c.maxWalkMin) &&
    (c.maxWalkM === null || p.walkM.value <= c.maxWalkM) &&
    (!c.avoidStairs || p.stairs.value === false) &&
    p.seat.value === true &&
    !c.avoidSituations.some((s) => p.situations.value?.includes(s));
  const requested = [...c.requiredExperiences, ...c.experiences];
  const candidates = places
    .filter((p) => p.kind === "visit" && eligible(p))
    .sort(
      (a, b) =>
        requested.filter((e) => b.experiences.includes(e)).length -
          requested.filter((e) => a.experiences.includes(e)).length ||
        (feedback.includes("걷는 구간을 줄여 주세요")
          ? (a.walkMin.value ?? Infinity) - (b.walkMin.value ?? Infinity)
          : 0),
    );
  const supportedFoods = ["매운 음식", "순한 음식", "지역 음식", "죽"];
  let meals = places
    .filter(
      (p) =>
        p.kind === "meal" &&
        eligible(p) &&
        p.foods.value !== null &&
        !c.foodAvoids.some(
          (f) => !supportedFoods.includes(f) || p.foods.value!.includes(f),
        ),
    )
    .sort(
      (a, b) =>
        c.foodLikes.filter((f) => b.foods.value!.includes(f)).length -
        c.foodLikes.filter((f) => a.foods.value!.includes(f)).length,
    );
  if (feedback.includes("식사를 바꾸고 싶어요")) {
    const old = new Set(
      original.filter((i) => i.kind === "meal").map((i) => i.placeId),
    );
    meals = meals.filter((p) => !old.has(p.id));
  }
  if (!candidates.length || !meals.length)
    return {
      items: [],
      reasons: [
        "현재 확인된 후보에서는 이 조건을 모두 맞추기 어렵습니다. 조건을 자동으로 낮추지 않았습니다.",
      ],
      preserved: [],
      blocked: true,
    };
  // Each tour and each transfer is separated by a real seated rest; constraints are never rewritten.
  const items: Item[] = [];
  const restDuration =
    (c.restMin ?? 20) + (feedback.includes("쉬는 시간을 늘려 주세요") ? 10 : 0);
  for (let day = 1; day <= b.days; day++) {
    let t = 570,
      n = 0,
      last: string | null = null;
    const first = candidates[(day - 1) % candidates.length];
    const remaining = requested.filter((e) => !first.experiences.includes(e));
    const second =
      candidates.find(
        (p) =>
          p.id !== first.id && remaining.some((e) => p.experiences.includes(e)),
      ) ??
      (feedback.includes("걷는 구간을 줄여 주세요")
        ? first
        : candidates.find((p) => p.id !== first.id)) ??
      first;
    const meal = meals[(day - 1) % meals.length];
    const rest = (p: Place) => {
      items.push(make(day, n++, t, t + restDuration, "rest", p.id));
      t += restDuration;
    };
    for (const [p, kind] of [
      [first, "visit"],
      [meal, "meal"],
      [second, "visit"],
    ] as const) {
      if (last && last !== p.id) {
        const r = getRoute(last, p.id, b.transport);
        if (!r || r.duration.value === null)
          return {
            items: [],
            reasons: ["이동 시간이 확인된 동선을 만들 수 없습니다."],
            preserved: [],
            blocked: true,
          };
        items.push(
          make(day, n++, t, t + r.duration.value, "move", null, {
            fromId: last,
            toId: p.id,
            transport: b.transport,
          }),
        );
        t += r.duration.value;
        rest(p);
      }
      if (kind === "meal" && t < 660) {
        // Wait seated until 11:00; extend the existing real rest rather than creating an unexplained gap.
        const previous = items.at(-1);
        if (previous?.kind === "rest") previous.end = 660;
        t = 660;
      }
      const desired = kind === "meal" ? 40 : 30;
      const duration = Math.max(
        p.walkMin.value ?? 0,
        Math.min(desired, c.restInterval ?? desired),
      );
      items.push(make(day, n++, t, t + duration, kind, p.id));
      t += duration;
      rest(p);
      last = p.id;
    }
  }
  const report = validateSchedule(items, c, b);
  const preserved = requested.filter((e) =>
    items.some((i) => placeById.get(i.placeId ?? "")?.experiences.includes(e)),
  );
  return {
    items,
    reasons: [
      "조건이 확인된 가상 후보에서 방문 장소를 다시 골랐어요.",
      `이동 방법은 선택하신 ${b.transport === "taxi" ? "택시" : "도보"}를 유지했어요.`,
      `실제로 앉을 수 있는 가상 공간에서 매번 ${restDuration}분 쉬도록 배치했어요.`,
      "점심을 오전 관광 다음에 배치했어요. 매운 음식 등 피하고 싶은 메뉴는 후보에서 제외했어요.",
      ...(feedback.length
        ? [
            "부모님 의견을 반영한 수정안입니다. 적용 전 새 점검 결과를 확인해 주세요.",
          ]
        : []),
    ],
    preserved,
    blocked: report.status === "violation" || report.status === "conflict",
  };
}
export function applyProposal(trip: Trip, items: Item[]): Trip {
  const locked = trip.items.filter((i) => i.locked);
  if (
    locked.some(
      (i) => !items.some((j) => JSON.stringify(i) === JSON.stringify(j)),
    )
  )
    throw new Error("고정 일정을 변경할 수 없습니다.");
  return {
    ...trip,
    items: structuredClone(items),
    revision: trip.revision + 1,
    history: [...trip.history, structuredClone(trip.items)].slice(-20),
  };
}
export function undo(trip: Trip): Trip {
  if (!trip.history.length) return trip;
  return {
    ...trip,
    items: trip.history.at(-1)!,
    history: trip.history.slice(0, -1),
    revision: trip.revision + 1,
  };
}
export function isCurrentResponse(
  requestRevision: number,
  currentRevision: number,
) {
  return requestRevision === currentRevision;
}
export function parseItinerary(
  text: string,
  day = 1,
): { items: Item[]; errors: string[] } {
  const items: Item[] = [],
    errors: string[] = [];
  for (const [index, line] of text.split("\n").entries()) {
    if (!line.trim()) continue;
    const match = line
      .trim()
      .match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})\s+(.+)$/);
    if (!match) {
      errors.push(
        `${index + 1}행: HH:MM-HH:MM 가상 장소명 형식으로 입력해 주세요.`,
      );
      continue;
    }
    const [, h, m, eh, em, name] = match;
    const p = places.find((p) => p.name === name || p.id === name);
    if (!p) {
      errors.push(
        `${index + 1}행: 가상 후보 목록의 정확한 장소명 또는 ID를 써 주세요.`,
      );
      continue;
    }
    const start = Number(h) * 60 + Number(m),
      end = Number(eh) * 60 + Number(em);
    if (
      Number(h) > 23 ||
      Number(eh) > 23 ||
      Number(m) > 59 ||
      Number(em) > 59 ||
      end <= start
    ) {
      errors.push(`${index + 1}행: 올바른 시작·종료 시간을 입력해 주세요.`);
      continue;
    }
    items.push(make(day, index, start, end, p.kind, p.id));
  }
  if (!items.length && !errors.length)
    errors.push("시간과 장소를 입력해 주세요.");
  return { items, errors };
}

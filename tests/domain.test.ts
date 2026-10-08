import { describe, it, expect } from "vitest";
import {
  conditionsSchema,
  basicsSchema,
  defaultConditions,
  demoConditions,
  defaultBasics,
  Item,
  Trip,
  Conditions,
  tripSchema,
} from "../src/domain/schema";
import { places, routes, placeById, evidenceIds } from "../src/data/demo";
import { validateSchedule } from "../src/domain/validate";
import {
  generate,
  demoItinerary,
  applyProposal,
  undo,
  isCurrentResponse,
  parseItinerary,
} from "../src/domain/engine";
import { loadTrip, saveTrip, STORAGE_KEY } from "../src/adapters/storage";

const b = { ...defaultBasics, days: 1 };
const c: Conditions = {
  ...defaultConditions,
  maxWalkMin: 20,
  maxWalkM: 800,
  restInterval: 240,
  restMin: 20,
};
const row = (
  id: string,
  kind: Item["kind"],
  start: number,
  end: number,
  placeId: string | null,
  patch: Partial<Item> = {},
): Item => ({
  id,
  kind,
  start,
  end,
  placeId,
  day: 1,
  mode: "demo",
  locked: false,
  fromId: null,
  toId: null,
  transport: null,
  ...patch,
});
const visit = (place = "p02", start = 600) =>
  row("v", "visit", start, start + 30, place);
const rest = (start = 630, end = 650) => row("r", "rest", start, end, "p02");
const move = (start = 588, end = 600) =>
  row("m", "move", start, end, null, {
    fromId: "p04",
    toId: "p02",
    transport: "walk",
  });
const codes = (rows: Item[], condition = c) =>
  validateSchedule(rows, condition, b).issues.map((i) => i.code);
const trip: Trip = {
  version: 1,
  id: "test",
  revision: 0,
  conditions: c,
  basics: b,
  items: [visit()],
  history: [],
  feedback: [],
};
describe("결정적 일정 검증", () => {
  it("이동 구간의 계단을 필수 회피 조건으로 점검한다", () =>
    expect(
      codes([{ ...move(), toId: "p01" }], { ...c, avoidStairs: true }),
    ).toContain("route-stairs"));
  it("이동 구간의 계단 미확인은 정보 부족으로 유지한다", () =>
    expect(
      validateSchedule(
        [{ ...move(), toId: "p15" }],
        { ...c, avoidStairs: true },
        b,
      ).issues.find((i) => i.code === "route-stairs")?.status,
    ).toBe("unknown"));
  it("최대 연속 보행 시간을 초과하면 탐지한다", () =>
    expect(codes([visit("p01")])).toContain("walk-time"));
  it("최대 연속 보행 거리 초과를 탐지한다", () =>
    expect(codes([visit("p01")])).toContain("walk-distance"));
  it("경계값과 같으면 초과가 아니다", () => {
    expect(
      codes([visit("p02")], { ...c, maxWalkMin: 8, maxWalkM: 320 }),
    ).not.toContain("walk-time");
    expect(
      codes([visit("p02")], { ...c, maxWalkMin: 8, maxWalkM: 320 }),
    ).not.toContain("walk-distance");
  });
  it("이동과 관광 내부 보행을 합산한다", () => {
    const issues = validateSchedule([move(), visit()], c, b).issues;
    expect(issues.find((i) => i.code === "walk-time")?.itemIds).toEqual([
      "m",
      "v",
    ]);
  });
  it("충분한 좌석 휴식은 연속 보행을 초기화한다", () => {
    expect(
      codes([visit(), rest(), { ...visit("p02", 650), id: "v2" }], {
        ...c,
        maxWalkMin: 8,
      }),
    ).not.toContain("walk-time");
  });
  it("너무 짧은 휴식으로 보행 기준을 우회할 수 없다", () => {
    const out = codes(
      [visit(), rest(630, 635), { ...visit("p02", 635), id: "v2" }],
      { ...c, maxWalkMin: 8 },
    );
    expect(out).toContain("short-rest");
    expect(out).toContain("walk-time");
  });
  it("좌석 미확인 휴식은 초기화하지 않는다", () => {
    const out = codes(
      [
        visit(),
        { ...rest(), placeId: "p15" },
        { ...visit("p02", 650), id: "v2" },
      ],
      { ...c, maxWalkMin: 8 },
    );
    expect(out).toContain("seat");
    expect(out).toContain("walk-time");
  });
  it("계단 회피 필수 조건 위반을 탐지한다", () =>
    expect(codes([visit("p01")], { ...c, avoidStairs: true })).toContain(
      "stairs",
    ));
  it("계단 미확인은 충족이 아닌 정보 부족이다", () => {
    expect(
      validateSchedule(
        [visit("p15")],
        { ...c, avoidStairs: true },
        b,
      ).issues.find((i) => i.code === "stairs")?.status,
    ).toBe("unknown");
  });
  it("이동 미확인은 0분으로 대체하지 않는다", () => {
    const issues = validateSchedule([{ ...move(), toId: "p15" }], c, b).issues;
    expect(issues.find((i) => i.code === "route")?.status).toBe("unknown");
    expect(issues.find((i) => i.code === "walking-data")).toBeDefined();
  });
  it("식사·휴식 겹침을 탐지한다", () =>
    expect(
      codes([
        row("meal", "meal", 600, 660, "p17"),
        row("rest", "rest", 620, 650, "p17"),
      ]),
    ).toContain("overlap"));
  it("종료가 시작보다 빠른 일정을 탐지한다", () =>
    expect(codes([{ ...visit(), end: 590 }])).toContain("time"));
  it("필요한 이동 시간보다 짧은 배정을 탐지한다", () =>
    expect(codes([{ ...move(), end: 589 }])).toContain("travel-time"));
  it("장소 변경 시 이동 항목 누락을 탐지한다", () =>
    expect(codes([visit(), { ...visit("p03", 630), id: "v2" }])).toContain(
      "missing-transfer",
    ));
  it("이동 출발지가 앞선 장소와 다른 경우 탐지한다", () =>
    expect(codes([visit(), { ...move(630, 660), fromId: "p03" }])).toContain(
      "route-origin",
    ));
  it("늦은 점심을 사용자 선택 기준으로 탐지한다", () =>
    expect(
      codes([row("meal", "meal", 850, 890, "p17")], { ...c, latestLunch: 810 }),
    ).toContain("lunch"));
  it("휴식 간격을 실제 시간으로 확인한다", () =>
    expect(
      codes([visit(), { ...visit("p02", 690), id: "v2" }], {
        ...c,
        restInterval: 60,
      }),
    ).toContain("rest-interval"));
  it("없는 음식 정보는 정보 부족으로 남긴다", () =>
    expect(
      validateSchedule(
        [row("meal", "meal", 700, 740, "p23")],
        c,
        b,
      ).issues.find((i) => i.code === "food")?.status,
    ).toBe("unknown"));
  it("자료에 없는 회피 음식의 부재를 추정하지 않는다", () =>
    expect(
      codes([row("meal", "meal", 700, 740, "p17")], {
        ...c,
        foodAvoids: ["해산물"],
      }),
    ).toContain("food-unknown"));
  it("예산 초과를 탐지한다", () =>
    expect(
      validateSchedule([visit()], c, { ...b, budget: 1 }).issues.some(
        (i) => i.code === "budget",
      ),
    ).toBe(true));
  it("중복 ID를 탐지한다", () =>
    expect(codes([visit(), visit("p03", 650)])).toContain("duplicate"));
  it("기간 밖 일정을 탐지한다", () =>
    expect(codes([{ ...visit(), day: 2 }])).toContain("day"));
  it("빈 일정은 충돌 상태다", () =>
    expect(validateSchedule([], c, b).status).toBe("conflict"));
  it("가상 일정에 실데이터를 섞을 수 없다", () =>
    expect(codes([{ ...visit(), mode: "real" as "demo" }])).toContain("mixed"));
});
describe("생성·수정·이력", () => {
  it("보행을 줄여 달라는 의견은 유지할 경험을 지키면서 더 짧은 후보를 선택한다", () => {
    const cc = { ...c, experiences: ["바다 보기"] };
    const original = generate(cc, b);
    const adjusted = generate(cc, b, original.items, [
      "걷는 구간을 줄여 주세요",
    ]);
    const internal = (items: Item[]) =>
      items
        .filter((i) => i.kind === "visit")
        .reduce(
          (sum, i) =>
            sum + (placeById.get(i.placeId ?? "")?.walkMin.value ?? 0),
          0,
        );
    expect(internal(adjusted.items)).toBeLessThan(internal(original.items));
    expect(adjusted.preserved).toContain("바다 보기");
  });
  it("가상 시연은 데이터로 40분 누적 구간을 탐지한다", () =>
    expect(
      validateSchedule(demoItinerary(b), demoConditions, b).issues.some(
        (i) => i.code === "walk-time" && i.message.includes("40분"),
      ),
    ).toBe(true));
  it("조건에 맞는 제안을 만들고 바다 경험을 유지한다", () => {
    const known = { ...demoConditions, maxWalkM: 800 };
    const p = generate(known, b);
    expect(p.blocked).toBe(false);
    expect(p.preserved).toContain("바다 보기");
    expect(validateSchedule(p.items, known, b).status).toBe("pass");
  });
  it("조건을 바꾸면 실제 결과가 달라진다", () => {
    const a = generate({ ...c, maxWalkMin: 20 }, b),
      small = generate({ ...c, maxWalkMin: 1 }, b);
    expect(a.items.length).toBeGreaterThan(0);
    expect(small.blocked).toBe(true);
    expect(small.items).toHaveLength(0);
  });
  it("정보가 없는 조건은 제안 후에도 정보 부족이다", () => {
    const p = generate(demoConditions, b);
    expect(validateSchedule(p.items, demoConditions, b).status).toBe("unknown");
  });
  it("조건을 모두 만족할 후보가 없으면 완화하지 않는다", () => {
    const frozen = { ...c, maxWalkMin: 1 };
    const before = JSON.stringify(frozen);
    expect(generate(frozen, b).blocked).toBe(true);
    expect(JSON.stringify(frozen)).toBe(before);
  });
  it("없는 필수 경험은 충돌로 보고한다", () => {
    const cc = { ...c, requiredExperiences: ["우주 여행"] };
    const p = generate(cc, b);
    expect(p.blocked).toBe(true);
    expect(
      validateSchedule(p.items, cc, b).issues.some(
        (i) => i.code === "required-experience",
      ),
    ).toBe(true);
  });
  it("고정 일정을 그대로 보존한다", () => {
    const locked = [{ ...visit("p01"), locked: true }];
    const p = generate(c, b, locked);
    expect(p.items).toEqual(locked);
    expect(p.blocked).toBe(true);
  });
  it("고정 구간을 변경하는 수정안을 적용할 수 없다", () => {
    const t = { ...trip, items: [{ ...visit(), locked: true }] };
    expect(() => applyProposal(t, [{ ...visit(), start: 620 }])).toThrow();
  });
  it("수정 후 새 일정으로 재검증하고 되돌릴 수 있다", () => {
    const original = { ...trip, items: demoItinerary(b) };
    const p = generate(c, b);
    const applied = applyProposal(original, p.items);
    expect(applied.revision).toBe(1);
    expect(
      validateSchedule(applied.items, c, b).issues.some(
        (i) => i.code === "walk-time",
      ),
    ).toBe(false);
    expect(undo(applied).items).toEqual(original.items);
    expect(undo(applied).revision).toBe(2);
  });
  it("부모님 의견은 더 긴 휴식 수정안으로 반영한다", () => {
    const a = generate(c, b),
      p = generate(c, b, a.items, ["쉬는 시간을 늘려 주세요"]);
    expect(
      p.items.find((i) => i.kind === "rest")!.end -
        p.items.find((i) => i.kind === "rest")!.start,
    ).toBe(30);
    expect(a.items).not.toEqual(p.items);
  });
  it("오래된 AI 응답은 최신 수정 버전과 일치하지 않는다", () => {
    expect(isCurrentResponse(3, 4)).toBe(false);
    expect(isCurrentResponse(4, 4)).toBe(true);
  });
  it("시연 데이터는 30곳과 양방향 이동표로 일관된다", () => {
    expect(places).toHaveLength(30);
    expect(routes).toHaveLength(30 * 29 * 2);
    expect(places.filter((p) => p.kind === "visit")).toHaveLength(15);
    expect(places.filter((p) => p.kind === "meal")).toHaveLength(8);
    expect(places.filter((p) => p.kind === "rest")).toHaveLength(7);
    expect(
      routes.every((r) => placeById.has(r.fromId) && placeById.has(r.toId)),
    ).toBe(true);
    expect(evidenceIds.size).toBeGreaterThan(30);
  });
  it("고정 없는 텍스트 일정은 정확한 후보만 허용한다", () => {
    expect(
      parseItinerary("09:30-10:15 가상 푸른창 바다쉼터").items,
    ).toHaveLength(1);
    expect(parseItinerary("09:30-10:15 실제 장소").errors).toHaveLength(1);
  });
  it("텍스트 시간 순서·빈 입력·잘못된 분을 거절한다", () => {
    expect(parseItinerary("").errors.length).toBeGreaterThan(0);
    expect(parseItinerary("24:60-09:00 p02").errors.length).toBeGreaterThan(0);
    expect(parseItinerary("10:00-09:30 p02").errors.length).toBeGreaterThan(0);
  });
});
describe("스키마와 브라우저 저장", () => {
  it("음수와 과도한 숫자를 거절한다", () => {
    expect(conditionsSchema.safeParse({ ...c, maxWalkMin: -1 }).success).toBe(
      false,
    );
    expect(conditionsSchema.safeParse({ ...c, maxWalkM: 10001 }).success).toBe(
      false,
    );
  });
  it("일부 조건을 모르는 사용자를 지원한다", () =>
    expect(conditionsSchema.safeParse(defaultConditions).success).toBe(true));
  it("활동 선호로 숫자를 채우지 않는다", () =>
    expect(
      conditionsSchema.parse({ ...defaultConditions, activity: "active" })
        .maxWalkMin,
    ).toBeNull());
  it("잘못된 날짜·기간·빈 제목을 거절한다", () => {
    for (const patch of [
      { date: "2026-02-30" },
      { days: 3 },
      { title: "" },
      { date: "bad" },
    ])
      expect(basicsSchema.safeParse({ ...b, ...patch }).success).toBe(false);
  });
  it("실데이터 모드는 가상 시연 스키마에 들어갈 수 없다", () =>
    expect(basicsSchema.safeParse({ ...b, mode: "real" }).success).toBe(false));
  it("버전이 다른 저장 데이터를 거절한다", () =>
    expect(tripSchema.safeParse({ ...trip, version: 2 }).success).toBe(false));
  it("새로고침 시 스키마 검증 후 복원한다", () => {
    let data = "";
    expect(
      saveTrip(
        {
          setItem: (_k, v) => {
            data = v;
          },
        },
        trip,
      ),
    ).toBeNull();
    expect(loadTrip({ getItem: () => data }).trip).toEqual(trip);
  });
  it("손상된 JSON이 앱을 멈추지 않는다", () =>
    expect(loadTrip({ getItem: () => "{bad" }).error).toBeTruthy());
  it("저장소 권한·용량 오류를 사용자 오류로 반환한다", () => {
    expect(
      saveTrip(
        {
          setItem: () => {
            throw Error("quota");
          },
        },
        trip,
      ),
    ).toBeTruthy();
    expect(
      loadTrip({
        getItem: () => {
          throw Error("denied");
        },
      }).error,
    ).toBeTruthy();
  });
  it("저장된 여행이 없으면 빈 상태를 반환한다", () =>
    expect(loadTrip({ getItem: () => null }).trip).toBeNull());
});

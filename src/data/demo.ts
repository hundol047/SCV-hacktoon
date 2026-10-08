export const DEMO_NOTICE = "가상 시연 데이터 · 실제 여행에 사용하지 마세요";
export type Fact<T> = {
  value: T | null;
  evidenceId: string;
  source: string;
  nature: "demo" | "real";
  checked: "simulated" | "source" | "user" | "unknown";
  collectedAt?: string | null;
};
const fact = <T>(id: string, field: string, value: T | null): Fact<T> => ({
  value,
  evidenceId: `${id}:${field}`,
  source: "보폭 가상 시연 데이터 v1 · 실제 조사 없음",
  nature: "demo",
  checked: "simulated",
});
export type Place = {
  id: string;
  name: string;
  kind: "visit" | "meal" | "rest";
  experiences: string[];
  description: string;
  walkMin: Fact<number>;
  walkM: Fact<number>;
  stairs: Fact<boolean>;
  seat: Fact<boolean>;
  foods: Fact<string[]>;
  cost: Fact<number>;
  hours: Fact<[number, number]>;
  situations: Fact<string[]>;
  latitude?: number;
  longitude?: number;
};
const names = [
  "바다마루 전망길",
  "푸른창 바다쉼터",
  "물결 작은정원",
  "소나무 산책뜰",
  "바람 언덕",
  "솔빛 전시관",
  "고요 문화관",
  "조개 사진뜰",
  "달빛 해변길",
  "솔향 숲길",
  "햇살 시장",
  "옛이야기 골목",
  "파도 전망대",
  "바다 그림관",
  "물빛 공원",
  "솔바다 매운밥집",
  "온기 한상",
  "고소한 국수집",
  "바다 순한정식",
  "솔향 채소식당",
  "느린 죽집",
  "작은 면가",
  "마을 밥상",
  "바다 벤치쉼터",
  "솔빛 휴게실",
  "나무 그늘쉼터",
  "고요 찻집",
  "물결 라운지",
  "정원 작은카페",
  "솔향 쉼터",
];
export const places: Place[] = names.map((name, i) => {
  const id = `p${String(i + 1).padStart(2, "0")}`;
  const kind = i < 15 ? "visit" : i < 23 ? "meal" : "rest";
  const exp =
    i === 0 || i === 1 || i === 8 || i === 12
      ? ["바다 보기"]
      : i === 5 || i === 6 || i === 13
        ? ["문화·전시"]
        : i === 10 || i === 11
          ? ["전통시장"]
          : ["자연 풍경"];
  const wm =
    i === 0
      ? 28
      : i === 1
        ? 8
        : i === 12
          ? 25
          : i === 14
            ? null
            : kind === "visit"
              ? 8 + (i % 3) * 3
              : 2;
  const food =
    kind === "meal"
      ? i === 15
        ? ["매운 음식", "지역 음식"]
        : i === 20
          ? ["순한 음식", "죽"]
          : ["순한 음식", "지역 음식"]
      : [];
  return {
    id,
    name: `가상 ${name}`,
    kind,
    experiences:
      kind === "visit"
        ? exp
        : kind === "meal"
          ? ["지역 음식"]
          : ["조용한 카페"],
    description:
      kind === "visit"
        ? `${exp[0]}를 즐기는 가상 공간입니다.`
        : kind === "meal"
          ? "가족이 함께 식사하는 가상 식당입니다."
          : "앉아서 쉬는 가상 공간입니다.",
    walkMin: fact(id, "walkMin", wm),
    walkM: fact(id, "walkM", wm === null ? null : wm * 40),
    stairs: fact(
      id,
      "stairs",
      i === 0 || i === 4 || i === 12 ? true : i === 14 ? null : false,
    ),
    seat: fact(id, "seat", i === 0 ? false : i === 14 ? null : true),
    foods: fact(id, "foods", i === 22 ? null : food),
    cost: fact(
      id,
      "cost",
      kind === "meal" ? 15000 : kind === "visit" ? 5000 : 3000,
    ),
    hours: fact(id, "hours", [540, 1080]),
    situations: fact(id, "situations", i === 10 ? ["붐비는 곳"] : []),
  };
});
export const placeById = new Map(places.map((p) => [p.id, p]));
export type Route = {
  id: string;
  fromId: string;
  toId: string;
  transport: "walk" | "taxi";
  duration: Fact<number>;
  walkMin: Fact<number>;
  walkM: Fact<number>;
  cost: Fact<number>;
  mode: "demo" | "real";
  stairs: Fact<boolean>;
};
// Authored synthetic route table; these values are scenarios, not geodesic or actual routes.
// The stable ordinal pairs select table entries; no coordinates or straight-line distances are used.
const routePatterns = [
  { walk: 12, m: 480, taxi: 10 },
  { walk: 18, m: 720, taxi: 12 },
  { walk: 24, m: 960, taxi: 15 },
];
export const routes: Route[] = places.flatMap((a, i) =>
  places.flatMap((b, j) => {
    if (i === j) return [];
    return (["walk", "taxi"] as const).map((transport) => {
      const id = `r:${a.id}:${b.id}:${transport}`,
        v = routePatterns[(i + j) % 3];
      const unknown = i === 14 || j === 14;
      return {
        id,
        fromId: a.id,
        toId: b.id,
        transport,
        duration: fact(
          id,
          "duration",
          unknown ? null : transport === "walk" ? v.walk : v.taxi,
        ),
        walkMin: fact(
          id,
          "walkMin",
          unknown ? null : transport === "walk" ? v.walk : 0,
        ),
        walkM: fact(
          id,
          "walkM",
          unknown ? null : transport === "walk" ? v.m : 0,
        ),
        cost: fact(id, "cost", transport === "taxi" ? 10000 : 0),
        stairs: fact(
          id,
          "stairs",
          unknown
            ? null
            : transport === "walk" &&
                (i === 0 || j === 0 || i === 12 || j === 12),
        ),
        mode: "demo",
      };
    });
  }),
);
export const routeById = new Map(routes.map((r) => [r.id, r]));
export const getRoute = (
  from: string | null,
  to: string | null,
  t: "walk" | "taxi" | null,
) => routeById.get(`r:${from}:${to}:${t}`);
export const evidenceIds = new Set([
  ...places.flatMap((p) =>
    [
      p.walkMin,
      p.walkM,
      p.stairs,
      p.seat,
      p.foods,
      p.cost,
      p.hours,
      p.situations,
    ].map((f) => f.evidenceId),
  ),
  ...routes.flatMap((r) =>
    [r.duration, r.walkMin, r.walkM, r.cost, r.stairs].map((f) => f.evidenceId),
  ),
]);

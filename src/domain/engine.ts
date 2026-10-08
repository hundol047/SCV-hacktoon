import { Basics, Conditions, Item, Trip } from "./schema";
import { places, placeById, getRoute, Place } from "../data/demo";
import { Catalog, demoCatalog } from "../data/catalog";
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
export type Proposal = import('./optimizer').SearchResult;
export { optimize as generate } from './optimizer';
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
  catalog: Catalog = demoCatalog,
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
        `${index + 1}행: HH:MM-HH:MM 장소명 형식으로 입력해 주세요.`,
      );
      continue;
    }
    const [, h, m, eh, em, name] = match;
    const p = catalog.places.find((p) => p.name === name || p.id === name);
    if (!p) {
      errors.push(
        `${index + 1}행: 조회한 후보 목록의 정확한 장소명 또는 ID를 써 주세요.`,
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
    items.push(make(day, index, start, end, p.kind, p.id, {mode:catalog.mode}));
  }
  if (!items.length && !errors.length)
    errors.push("시간과 장소를 입력해 주세요.");
  return { items, errors };
}

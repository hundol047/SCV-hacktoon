import { z } from "zod";

const optionalLimit = (max: number) =>
  z.number().int().min(1).max(max).nullable();
export const conditionsSchema = z.object({
  activity: z.enum(["slow", "moderate", "active", "unknown"]),
  maxWalkMin: optionalLimit(180),
  maxWalkM: optionalLimit(10000),
  restInterval: optionalLimit(240),
  restMin: optionalLimit(120),
  avoidStairs: z.boolean(),
  foodLikes: z.array(z.string().max(60)).max(12),
  foodAvoids: z.array(z.string().max(60)).max(12),
  experiences: z.array(z.string().max(60)).max(12),
  requiredExperiences: z.array(z.string().max(60)).max(12),
  avoidSituations: z.array(z.string().max(100)).max(12),
  latestLunch: z.number().int().min(660).max(900).nullable(),
});
export type Conditions = z.infer<typeof conditionsSchema>;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === v;
  }, "올바른 날짜를 입력해 주세요.");
export const basicsSchema = z.object({
  title: z.string().trim().min(1).max(80),
  region: z.literal("가상 솔바다"),
  date,
  days: z.number().int().min(1).max(2),
  budget: z.number().int().min(0).max(10000000),
  transport: z.enum(["taxi", "walk"]),
  mode: z.literal("demo"),
});
export type Basics = z.infer<typeof basicsSchema>;
export const itemSchema = z.object({
  id: z.string().min(1).max(100),
  day: z.number().int().min(1).max(2),
  start: z.number().int().min(0).max(1439),
  end: z.number().int().min(0).max(1440),
  kind: z.enum(["move", "visit", "meal", "rest"]),
  placeId: z.string().max(100).nullable(),
  fromId: z.string().max(100).nullable(),
  toId: z.string().max(100).nullable(),
  transport: z.enum(["taxi", "walk"]).nullable(),
  locked: z.boolean(),
  mode: z.literal("demo"),
});
export type Item = z.infer<typeof itemSchema>;
export const feedbackSchema = z.object({
  id: z.string(),
  text: z.enum([
    "좋아요",
    "걷는 구간을 줄여 주세요",
    "쉬는 시간을 늘려 주세요",
    "식사를 바꾸고 싶어요",
  ]),
  at: z.string(),
});
export const tripSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  revision: z.number().int().nonnegative(),
  conditions: conditionsSchema,
  basics: basicsSchema,
  items: z.array(itemSchema).max(100),
  history: z.array(z.array(itemSchema).max(100)).max(20),
  feedback: z.array(feedbackSchema).max(30),
});
export type Trip = z.infer<typeof tripSchema>;
export const defaultConditions: Conditions = {
  activity: "unknown",
  maxWalkMin: null,
  maxWalkM: null,
  restInterval: null,
  restMin: null,
  avoidStairs: false,
  foodLikes: [],
  foodAvoids: [],
  experiences: [],
  requiredExperiences: [],
  avoidSituations: [],
  latestLunch: null,
};
export const demoConditions: Conditions = {
  ...defaultConditions,
  activity: "slow",
  maxWalkMin: 20,
  restInterval: 60,
  restMin: 20,
  avoidStairs: true,
  foodAvoids: ["매운 음식"],
  experiences: ["바다 보기"],
  latestLunch: 810,
};
export const defaultBasics: Basics = {
  title: "우리 가족의 느긋한 여행",
  region: "가상 솔바다",
  date: "2026-10-17",
  days: 2,
  budget: 300000,
  transport: "taxi",
  mode: "demo",
};
export const time = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const minutes = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
export function dayDate(b: Basics, day: number) {
  const d = new Date(b.date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d.toISOString().slice(0, 10);
}

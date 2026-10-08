import { z } from "zod";
import { catalogSchema } from '../data/catalog';

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
  region: z.string().min(1).max(120),
  date,
  days: z.number().int().min(1).max(30),
  budget: z.number().int().min(0).max(10000000),
  transport: z.enum(["taxi", "walk", "driving", "transit"]),
  mode: z.enum(['demo','real']),
  currency:z.string().regex(/^[A-Z]{3}$/).optional(),
  destinations:z.array(z.object({region:z.string().min(1).max(120),startDay:z.number().int().min(1).max(30),endDay:z.number().int().min(1).max(30),timezone:z.string().max(80).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}}),currency:z.string().regex(/^[A-Z]{3}$/)})).max(10).optional(),
  expenses:z.array(z.object({label:z.string().min(1).max(120),category:z.enum(['lodging','intercity','other']).optional(),amount:z.number().nonnegative().max(100000000).nullable(),currency:z.string().regex(/^[A-Z]{3}$/)})).max(100).optional(),
  transfers:z.array(z.object({fromRegion:z.string().min(1).max(120),toRegion:z.string().min(1).max(120),departure:z.iso.datetime({offset:true}),arrival:z.iso.datetime({offset:true}),source:z.string().url().max(1000).refine(v=>new URL(v).protocol==='https:'),mode:z.enum(['flight','rail','bus','ferry','driving'])})).max(30).optional(),
  timezone:z.string().max(80).default('Asia/Seoul').refine(v=>{try{new Intl.DateTimeFormat('ko-KR',{timeZone:v});return true;}catch{return false;}},'IANA 시간대 이름을 확인해 주세요.'),
}).refine(b=>b.mode!=='demo'||b.days<=2,'시연은 1~2일을 지원합니다.').superRefine((b,ctx)=>{if(b.destinations?.length){for(let day=1;day<=b.days;day++)if(b.destinations.filter(d=>d.startDay<=day&&d.endDay>=day).length!==1)ctx.addIssue({code:'custom',message:day+'일차 도시를 하나씩 지정해 주세요.'});for(const d of b.destinations)if(d.startDay>d.endDay||d.endDay>b.days)ctx.addIssue({code:'custom',message:'도시 날짜 범위를 확인해 주세요.'});}if(b.mode==='demo'&&(b.transport==='driving'||b.transport==='transit'))ctx.addIssue({code:'custom',message:'시연은 택시·도보 경로만 지원합니다.'});}).refine(b=>(b.mode==='demo')===(b.region==='가상 솔바다'),'지역과 데이터 모드가 일치하지 않습니다.');
export type Basics = z.infer<typeof basicsSchema>;
export const itemSchema = z.object({
  id: z.string().min(1).max(100),
  day: z.number().int().min(1).max(30),
  start: z.number().int().min(0).max(1439),
  end: z.number().int().min(0).max(1440),
  kind: z.enum(["move", "visit", "meal", "rest"]),
  placeId: z.string().max(100).nullable(),
  fromId: z.string().max(100).nullable(),
  toId: z.string().max(100).nullable(),
  transport: z.enum(["taxi", "walk", "driving", "transit"]).nullable(),
  locked: z.boolean(),
  mode: z.enum(['demo','real']),
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
  items: z.array(itemSchema).max(1000),
  history: z.array(z.array(itemSchema).max(1000)).max(20),
  feedback: z.array(feedbackSchema).max(30),
  catalog: catalogSchema.optional(),
}).superRefine((t,ctx)=>{if(t.items.some(i=>i.mode!==t.basics.mode)||t.history.some(h=>h.some(i=>i.mode!==t.basics.mode))||t.catalog&&t.catalog.mode!==t.basics.mode)ctx.addIssue({code:'custom',message:'실제·가상 여행 데이터를 섞을 수 없습니다.'});if(t.basics.mode==='real'&&!t.catalog)ctx.addIssue({code:'custom',message:'실제 여행은 출처가 있는 자료 집합이 필요합니다.'});});
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
  timezone:'Asia/Seoul',
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

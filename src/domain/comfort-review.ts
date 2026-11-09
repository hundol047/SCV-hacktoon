import {z} from 'zod';
export const journeySteps=['승하차·주차장 → 입구','입구 → 관람 공간','관람 공간 → 화장실','관람 공간 → 휴식 공간','숙소 입구 → 객실','객실 → 욕실'] as const;
export const journeyReportSchema=z.object({placeId:z.string().min(1).max(120),step:z.enum(journeySteps),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;}),method:z.enum(['visit','operator']),outcome:z.enum(['usable','assistance','blocked']),minutes:z.number().int().min(0).max(240).nullable(),note:z.string().min(1).max(500)});
export const comfortReviewSchema=z.object({reports:z.array(journeyReportSchema).max(100),survey:z.object({walking:z.number().int().min(1).max(5),rest:z.number().int().min(1).max(5),accuracy:z.number().int().min(1).max(5),comment:z.string().max(1000)}).optional()});
export type JourneyReport=z.infer<typeof journeyReportSchema>;
export function reportFresh(date:string,now=Date.now()){const age=now-Date.parse(date+'T00:00:00Z');return age>=0&&age<7*86400000;}

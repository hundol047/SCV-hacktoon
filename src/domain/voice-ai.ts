import {z} from 'zod';
import {gangwonDistricts} from '../data/gangwon-areas';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;});
const region=z.string().refine(v=>(gangwonDistricts as readonly string[]).includes(v),'강원 여행 지역을 선택하세요.');
export const voicePatchSchema=z.object({departure:z.string().trim().min(1).max(120).nullable(),region:region.nullable(),date:date.nullable(),days:z.number().int().min(1).max(5).nullable(),travelers:z.number().int().min(1).max(20).nullable(),transport:z.enum(['taxi','driving']).nullable(),comfort:z.boolean().nullable(),walkLimit:z.number().int().min(1).max(180).nullable(),restMinutes:z.number().int().min(1).max(120).nullable(),interests:z.array(z.enum(['자연 풍경','문화·전시','지역 음식','사진 찍기','바다 보기','조용한 카페','겨울 레저'])).max(7).nullable(),access:z.array(z.enum(['stepFree','wheelchair','ramp','gentleSlope','elevator','accessibleToilet'])).max(6).nullable()});
export const emptyVoicePatch={departure:null,region:null,date:null,days:null,travelers:null,transport:null,comfort:null,walkLimit:null,restMinutes:null,interests:null,access:null};
export const voiceContextSchema=z.object({departure:z.string().max(120),region,date,days:z.number().int().min(1).max(5),travelers:z.number().int().min(1).max(20),transport:z.enum(['taxi','driving']),comfort:z.boolean(),walkLimit:z.number().int().min(1).max(180).nullable(),restMinutes:z.number().int().min(1).max(120).nullable(),interests:z.array(z.string().max(60)).max(12),access:z.array(z.string().max(40)).max(6)});
export const voiceReplySchema=z.object({action:z.enum(['update','generate','clarify','answer','cancel']),patch:voicePatchSchema,reply:z.string().trim().min(1).max(600),questions:z.array(z.string().min(1).max(200)).max(3)});
export const voiceRequestSchema=z.object({text:z.string().trim().min(1).max(1200),context:voiceContextSchema,history:z.array(z.object({role:z.enum(['user','assistant']),text:z.string().min(1).max(1200)})).max(6),consent:z.literal(true)});
export type VoiceContext=z.infer<typeof voiceContextSchema>;
export type VoiceAIReply=z.infer<typeof voiceReplySchema>;
export type VoiceTurn={role:'user'|'assistant';text:string};
export function validateVoiceReply(raw:unknown,context:VoiceContext,today:string):VoiceAIReply{
 const result=voiceReplySchema.parse(raw);
 if(result.patch.date&&result.patch.date<today)throw Error('AI가 지난 날짜를 제안했습니다. 출발일을 다시 말해 주세요.');
 if(result.action==='cancel'||result.action==='answer')return {...result,patch:{...emptyVoicePatch}};
 if(result.action==='generate'&&(result.questions.length||!(result.patch.departure??context.departure).trim()))return {...result,action:'clarify',questions:result.questions.length?result.questions:['어디에서 출발하시나요?'],reply:result.questions.length?result.reply:'출발지를 알려주시면 일정을 만들게요.'};
 return result;
}
function statedMinutes(text:string){
 const native:Record<string,number>={한:1,두:2,세:3,네:4,다섯:5,여섯:6,일곱:7,여덟:8,아홉:9,열:10,열한:11,열두:12,열세:13,열네:14,열다섯:15,스무:20,서른:30};
 function number(s:string){if(/^\d+$/.test(s))return Number(s);if(native[s])return native[s];if(!/^[일이삼사오육칠팔구십백]+$/.test(s))return NaN;let sum=0,digit=0;for(const c of s){if(c==='십'||c==='백'){sum+=(digit||1)*(c==='십'?10:100);digit=0;}else digit='일이삼사오육칠팔구'.indexOf(c)+1;}return sum+digit;}
 const values=[...text.matchAll(/(\d+|[일이삼사오육칠팔구십백한두세네다섯여섯일곱여덟아홉열스무서른]+)\s*(분|시간)/g)].map(m=>number(m[1])*(m[2]==='시간'?60:1));
 for(const m of text.matchAll(/(\d+)\s*시간\s*(\d+)\s*분/g))values.push(Number(m[1])*60+Number(m[2]));return values;
}
export function groundVoiceLimits(result:VoiceAIReply,context:VoiceContext,userText:string):VoiceAIReply{
 const values=statedMinutes(userText),patch={...result.patch},questions=[...result.questions];
 for(const k of ['walkLimit','restMinutes'] as const){const v=patch[k];if(v!==null&&v!==context[k]&&!values.includes(v)){patch[k]=null;questions.push(k==='walkLimit'?'연속해서 몇 분 정도 걸을 수 있나요?':'한 번에 몇 분 정도 쉬고 싶으세요?');}}
 return questions.length>result.questions.length?{...result,patch,action:'clarify',reply:'구체적인 시간은 직접 알려주신 값으로 반영할게요.',questions:[...new Set(questions)].slice(0,3)}:result;
}

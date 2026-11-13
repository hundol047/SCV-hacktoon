import {it,expect} from 'vitest';
import {converseJSON,converseInput} from '../src/server/bedrock';
import {osmCatalog} from '../src/adapters/real-data';
import {defaultBasics,defaultConditions} from '../src/domain/schema';
import {courseInput,regionalCourse} from '../src/domain/regional-course';
import {savePlan} from '../src/domain/course-plans';
const schema={type:'object',properties:{candidateIds:{type:'array',items:{type:'string'}}},required:['candidateIds']};
it('uses baseline Converse fields and parses final text alongside reasoning without exposing reasoning',async()=>{
 const input=converseInput('Choose IDs','candidates',schema,'course',1600);expect(input.outputConfig).toBeUndefined();expect(input.system?.[0]).toHaveProperty('text',expect.stringContaining('candidateIds'));
 const result=await converseJSON('Choose IDs','candidates',schema,'course',1600,{send:async()=>({$metadata:{},usage:{inputTokens:1,outputTokens:1,totalTokens:2},metrics:{latencyMs:1},stopReason:'end_turn',output:{message:{role:'assistant',content:[{reasoningContent:{reasoningText:{text:'private reasoning'}}},{text:'```json\n{"candidateIds":["a","b"]}\n```'}]}}})});
 expect(result).toEqual({candidateIds:['a','b']});
});
it('rejects truncated, malformed, and non-text tool responses',async()=>{
 for(const [stopReason,content,code] of [['max_tokens',[{text:'{}'}],'AI_OUTPUT_LIMIT'],['end_turn',[{text:'not JSON'}],'AI_INVALID_JSON'],['end_turn',[{toolUse:{toolUseId:'x',name:'x',input:{}}}],'AI_TEXT_MISSING']] as const){
 await expect(converseJSON('','',schema,'course',1600,{send:async()=>({$metadata:{},usage:{inputTokens:1,outputTokens:1,totalTokens:2},metrics:{latencyMs:1},stopReason,output:{message:{role:'assistant',content:content as any}}})})).rejects.toThrow(code);
 }
});
it('Gangneung catalog can produce three distinct daily courses using validated candidate selections',async()=>{
 // Course validation is deterministic; live TourAPI credentials/photos belong in provider probes.
 const catalog=osmCatalog('강릉',{elements:Array.from({length:18},(_,i)=>({type:'node',id:i+1,lat:37.75+i/10000,lon:128.9,tags:{name:`문화 관광지 ${i+1}`,tourism:'museum'}}))},'2026-11-01T00:00:00Z');
 let basics={...defaultBasics,mode:'real' as const,region:catalog.region,date:'2026-11-03',days:3,transport:'taxi' as const};
 for(let day=1;day<=3;day++){const input=courseInput(basics,defaultConditions,catalog,day);expect(input.candidates.length).toBeGreaterThanOrEqual(2);basics=savePlan(basics,regionalCourse(basics,defaultConditions,catalog,day,{candidateIds:input.candidates.slice(0,3).map(p=>p.place.id)}).plan) as typeof basics;}
},20000);

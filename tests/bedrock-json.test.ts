import {it,expect} from 'vitest';
import {converseJSON,converseInput} from '../src/server/bedrock';
import {GET} from '../src/app/api/tourism/route';
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
 const response=await GET(new Request('http://localhost/api/tourism?action=catalog&q='+encodeURIComponent('강릉')+'&limit=200'));expect(response.status).toBe(200);const catalog=await response.json();
 let basics={...defaultBasics,mode:'real' as const,region:catalog.region,date:'2026-11-03',days:3,transport:'taxi' as const};
 for(let day=1;day<=3;day++){const input=courseInput(basics,defaultConditions,catalog,day);expect(input.candidates.length).toBeGreaterThanOrEqual(2);basics=savePlan(basics,regionalCourse(basics,defaultConditions,catalog,day,{candidateIds:input.candidates.slice(0,3).map(p=>p.place.id)}).plan) as typeof basics;}
},20000);

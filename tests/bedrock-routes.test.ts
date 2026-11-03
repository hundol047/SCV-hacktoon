import {it,expect,vi,afterEach} from 'vitest';
import * as bedrock from '../src/server/bedrock';
import * as budget from '../src/server/ai-budget';
import {POST as courses} from '../src/app/api/courses/route';
import {POST as promotions} from '../src/app/api/promotions/route';
import {defaultBasics,defaultConditions} from '../src/domain/schema';
import {osmCatalog} from '../src/adapters/real-data';
import {courseInput} from '../src/domain/regional-course';
const catalog=osmCatalog('서울',{elements:[1,2,3].map(id=>({type:'node',id,lat:37.57+id/10000,lon:126.98,tags:{name:'실제 후보 '+id,tourism:'museum'}}))},new Date().toISOString());
const basics={...defaultBasics,mode:'real' as const,region:'서울',days:1,transport:'taxi' as const};
const payload={basics,conditions:defaultConditions,catalog,day:1,consent:true};
const request=(path:string,data:unknown)=>new Request('http://localhost'+path,{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify(data)});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
function configured(){vi.stubEnv('AWS_REGION','ap-southeast-2');vi.spyOn(budget,'reserveAI').mockResolvedValue({allowed:true,message:'test'});}
it('course route validates Bedrock output against supplied candidates, not just the JSON schema',async()=>{
 configured();const send=vi.spyOn(bedrock,'converseJSON').mockResolvedValue({candidateIds:courseInput(basics,defaultConditions,catalog,1).candidates.slice(0,2).map(p=>p.place.id)});
 expect((await courses(request('/api/courses',payload))).status).toBe(200);expect(send.mock.calls[0][3]).toBe('course');
 send.mockResolvedValue({candidateIds:['invented','invented']});expect((await courses(request('/api/courses',payload))).status).toBe(502);
});
it('budget refusal sends no Converse request and Bedrock failure preserves input data',async()=>{
 configured();const send=vi.spyOn(bedrock,'converseJSON').mockRejectedValue(Error('synthetic Bedrock outage'));const before=JSON.stringify(payload);
 expect((await courses(request('/api/courses',payload))).status).toBe(502);expect(JSON.stringify(payload)).toBe(before);
 send.mockClear();vi.mocked(budget.reserveAI).mockResolvedValue({allowed:false,message:'budget'});expect((await courses(request('/api/courses',payload))).status).toBe(429);expect(send).not.toHaveBeenCalled();
});
it('promotion route rejects malformed generated content and reports a controlled provider error',async()=>{
 configured();vi.spyOn(bedrock,'converseJSON').mockResolvedValue({invented:'invalid'});
 const response=await promotions(request('/api/promotions',{consent:true,input:{business:'여행카페',region:'서울',category:'카페',facts:'커피를 판매합니다.',offer:'',channel:'instagram',tone:'friendly'}}));
 expect(response.status).toBe(502);expect((await response.json()).error).toContain('초안');
});

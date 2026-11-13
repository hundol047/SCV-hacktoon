import {it,expect,vi,afterEach} from 'vitest';
import {readEvidenceImage} from '../src/server/evidence-reader';
import * as reader from '../src/server/evidence-reader';
import * as budget from '../src/server/ai-budget';
import {BEDROCK_MODEL} from '../src/server/bedrock';
import {POST} from '../src/app/api/evidence-read/route';
import {evidenceReady,evidenceSummary,type TripEvidence} from '../src/domain/trip-evidence';
import {halfPriceDocuments} from '../src/domain/half-price-documents';
import {defaultBasics,defaultConditions,type Trip} from '../src/domain/schema';
const reading={label:'영월 식당',date:'2026-11-10',amount:30000,note:''};
const row:TripEvidence={id:'r',tripId:'trip',city:'영월',kind:'receipt',name:'receipt.jpg',createdAt:'2026-11-10',original:new Blob(),preview:new Blob(),reading,confirmed:false};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
it('requires review and complete fields before totaling evidence, and rejects invalid dates',()=>{
 expect(evidenceSummary([row]).total).toBe(0);expect(evidenceSummary([{...row,confirmed:true}]).total).toBe(30000);
 expect(evidenceReady({...row,reading:{...reading,date:'2026-02-30'}})).toBe(false);
 expect(evidenceReady({...row,reading:{...reading,amount:null}})).toBe(false);
});
it('only confirmed evidence from the selected trip and region fills settlement text',()=>{
 const trip:Trip={version:1,id:'trip',revision:0,basics:{...defaultBasics,date:'2026-11-10',days:1},conditions:defaultConditions,items:[],history:[],feedback:[]};
 const result=halfPriceDocuments(trip,'영월',[{...row,confirmed:true},{...row,id:'other',city:'화천',reading:{...reading,label:'다른 지역'},confirmed:true}]);
 expect(result.settlement).toContain('30,000원');expect(result.settlement).not.toContain('다른 지역');expect(result.settlement).toContain('심사에 따릅니다');
});
it('uses the unchanged Bedrock model with bounded image input and forces visit amounts to null',async()=>{
 const send=vi.fn().mockResolvedValue({stopReason:'end_turn',output:{message:{content:[{text:JSON.stringify(reading)}]}}});
 const result=await readEvidenceImage(new Uint8Array([255,216,255]),'visit',{send});expect(result.amount).toBeNull();expect(send.mock.calls[0][0].input.modelId).toBe(BEDROCK_MODEL);expect(send.mock.calls[0][0].input.messages[0].content[1].image.format).toBe('jpeg');
 send.mockResolvedValue({stopReason:'max_tokens'});await expect(readEvidenceImage(new Uint8Array([255,216,255]),'receipt',{send})).rejects.toThrow();
});
it('requires consent, same origin, valid image and budget before invoking vision',async()=>{
 vi.stubEnv('BOPok_APP_URL','http://localhost');vi.stubEnv('AWS_REGION','ap-southeast-2');
 const gate=vi.spyOn(budget,'reserveAI').mockResolvedValue({allowed:true,message:'ok'});const scan=vi.spyOn(reader,'readEvidenceImage').mockResolvedValue(reading);
 const body={kind:'receipt',image:Buffer.from([255,216,255,224,0,0]).toString('base64'),consent:true};
 const req=(value:unknown,origin='http://localhost')=>new Request('http://localhost/api/evidence-read',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(value)});
 expect((await POST(req(body,'https://other.example'))).status).toBe(403);expect((await POST(req({...body,consent:false}))).status).toBe(400);expect((await POST(req({...body,image:'YWJjZGVmZ2g='}))).status).toBe(400);expect(gate).not.toHaveBeenCalled();
 gate.mockResolvedValue({allowed:false,message:'budget'});expect((await POST(req(body))).status).toBe(429);expect(scan).not.toHaveBeenCalled();
 gate.mockResolvedValue({allowed:true,message:'ok'});expect((await POST(req(body))).status).toBe(200);expect(scan).toHaveBeenCalledOnce();
});

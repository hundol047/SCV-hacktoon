import {describe,it,expect} from 'vitest';
import {journeyReportSchema,reportFresh} from '../src/domain/comfort-review';
import {createEvidenceBackup,openEvidenceBackup} from '../src/adapters/evidence-backup';
import {tripSchema,defaultBasics,defaultConditions} from '../src/domain/schema';
import {osmCatalog} from '../src/adapters/real-data';
import {policyChecklist} from '../src/domain/policy-checklist';
import {halfPriceDocuments} from '../src/domain/half-price-documents';
const trip=tripSchema.parse({version:1,id:'review',revision:0,basics:{...defaultBasics,region:'화천',mode:'real',date:'2026-11-10',days:1},conditions:defaultConditions,items:[],history:[],feedback:[],catalog:osmCatalog('화천',{elements:[]},new Date().toISOString())});
const receipt={id:'one',tripId:'review',city:'화천',kind:'receipt' as const,name:'original.png',createdAt:'2026-11-10T00:00:00Z',original:new Blob(['original'],{type:'image/png'}),preview:new Blob(['preview'],{type:'image/png'}),reading:{label:'식사',date:'2026-11-10',amount:70000,note:''},confirmed:true};
describe('companion evidence and policy checks',()=>{
 it('rejects impossible dates and never treats old or future records as fresh',()=>{expect(journeyReportSchema.safeParse({placeId:'p',step:'입구 → 관람 공간',date:'2026-02-30',method:'visit',outcome:'usable',minutes:5,note:'직접 확인'}).success).toBe(false);expect(reportFresh('2026-11-10',Date.parse('2026-11-09'))).toBe(false);expect(reportFresh('2026-11-01',Date.parse('2026-11-09'))).toBe(false);});
 it('encrypts originals and draft, refuses wrong password/trip and resets confirmation',async()=>{const packed=await createEvidenceBackup('review','화천',[receipt],'작성한 초안','correct-password');expect(JSON.stringify(packed)).not.toContain('식사');const opened=await openEvidenceBackup(packed,'correct-password','review','화천');expect(await opened.rows[0].original.text()).toBe('original');expect(opened.rows[0].confirmed).toBe(false);expect(opened.draft).toBe('작성한 초안');await expect(openEvidenceBackup(packed,'wrong-password','review','화천')).rejects.toThrow();await expect(openEvidenceBackup(packed,'correct-password','other','화천')).rejects.toThrow('다른 백업');});
 it('excludes out-of-trip receipts from settlement and flags them in checklist',()=>{const outside={...receipt,reading:{...receipt.reading,date:'2026-11-12'}};expect(policyChecklist(trip,'화천',[outside]).outside).toHaveLength(1);expect(halfPriceDocuments(trip,'화천',[outside]).settlement).not.toContain('70,000원');expect(halfPriceDocuments(trip,'화천',[receipt]).settlement).toContain('70,000원');});
});

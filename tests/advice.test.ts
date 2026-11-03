import type {ConverseSender} from '../src/server/bedrock';
import {it,expect} from 'vitest';
import {requestAdvice} from '../src/adapters/advice';
import {defaultBasics,demoConditions,Trip} from '../src/domain/schema';
import {demoItinerary} from '../src/domain/engine';
const trip:Trip={version:1,id:'test',revision:0,conditions:demoConditions,basics:{...defaultBasics,days:1},items:demoItinerary({...defaultBasics,days:1}),history:[],feedback:[]};
const reply=(candidateIds:string[],focusCodes:string[]):ConverseSender=>({send:async()=>({$metadata:{},usage:undefined,metrics:undefined,stopReason:'end_turn',output:{message:{role:'assistant',content:[{text:JSON.stringify({candidateIds,focusCodes})}]}}})});
it('AI advice rejects unknown place IDs and fabricated evidence codes',async()=>{await expect(requestAdvice(trip,reply(['invented'],[]))).rejects.toThrow();await expect(requestAdvice(trip,reply([],['invented']))).rejects.toThrow();});
it('AI advice returns existing rule messages and never edits fixed itinerary',async()=>{const before=JSON.stringify(trip);const result=await requestAdvice(trip,reply(['p01'],['walk-time']));expect(result.candidates[0].id).toBe('p01');expect(result.explanations.length).toBeGreaterThan(0);expect(JSON.stringify(trip)).toBe(before);});

import {it,expect} from 'vitest';
import {requestAdvice} from '../src/adapters/advice';
import {defaultBasics,demoConditions,Trip} from '../src/domain/schema';
import {demoItinerary} from '../src/domain/engine';
const trip:Trip={version:1,id:'test',revision:0,conditions:demoConditions,basics:{...defaultBasics,days:1},items:demoItinerary({...defaultBasics,days:1}),history:[],feedback:[]};
const reply=(candidateIds:string[],focusCodes:string[])=>async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({candidateIds,focusCodes})}]}]});
it('AI advice rejects unknown place IDs and fabricated evidence codes',async()=>{await expect(requestAdvice(trip,'synthetic','test',reply(['invented'],[]))).rejects.toThrow();await expect(requestAdvice(trip,'synthetic','test',reply([],['invented']))).rejects.toThrow();});
it('AI advice returns existing rule messages and never edits fixed itinerary',async()=>{const before=JSON.stringify(trip);const result=await requestAdvice(trip,'synthetic','test',reply(['p01'],['walk-time']));expect(result.candidates[0].id).toBe('p01');expect(result.explanations.length).toBeGreaterThan(0);expect(JSON.stringify(trip)).toBe(before);});

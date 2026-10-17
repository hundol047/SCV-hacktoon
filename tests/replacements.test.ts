import {expect,it} from 'vitest';
import {defaultBasics,defaultConditions,type Trip} from '../src/domain/schema';
import {applyReplacement,replacementInput,replacementItems,validateReplacements} from '../src/domain/replacements';
const trip=():Trip=>({version:1,id:'replace-test',revision:0,basics:{...defaultBasics,days:1},conditions:defaultConditions,history:[],feedback:[],items:[{id:'visit',day:1,start:600,end:690,kind:'visit',placeId:'p01',fromId:null,toId:null,transport:null,locked:false,mode:'demo'}]});
it('AI candidates are restricted to eligible known attractions and invalid model output is rejected',()=>{
  const t=trip(),input=replacementInput(t,'visit');expect(input.candidates.length).toBeGreaterThan(0);
  expect(input.candidates.every(p=>p.kind==='visit'&&p.id!=='p01')).toBe(true);
  expect(()=>validateReplacements(t,'visit',{candidateIds:['invented']})).toThrow();
  expect(()=>validateReplacements(t,'visit',{candidateIds:['p02','p02']})).toThrow();
  expect(()=>validateReplacements(t,'visit',{candidateIds:['p01']})).toThrow();
});
it('replacement is explicit, records undo history, and does not mutate the original',()=>{
  const t=trip(),before=JSON.stringify(t);const result=validateReplacements(t,'visit',{candidateIds:['p02']});
  expect(JSON.stringify(t)).toBe(before);expect(result[0].items[0].placeId).toBe('p02');
  const updated=applyReplacement(t,'visit','p02');expect(updated.items[0].placeId).toBe('p02');expect(updated.history[0]).toEqual(t.items);expect(updated.revision).toBe(1);
});
it('locked attractions and attached locked moves are never rewritten',()=>{
  const t=trip();t.items[0].locked=true;expect(()=>replacementInput(t,'visit')).toThrow();
  t.items[0].locked=false;t.items.unshift({...t.items[0],id:'move',kind:'move',placeId:null,fromId:'p04',toId:'p01',transport:'taxi',start:580,end:600,locked:true});
  expect(()=>replacementItems(t,'visit','p02')).toThrow();
});
it('replacement preserves required experiences and rejects incompatible choices',()=>{
  const t=trip();t.conditions={...defaultConditions,requiredExperiences:['바다 보기']};
  expect(()=>replacementItems(t,'visit','p03')).toThrow();
  expect(replacementItems(t,'visit','p02').items[0].placeId).toBe('p02');
  expect(()=>replacementItems(t,'visit','p17')).toThrow();
});

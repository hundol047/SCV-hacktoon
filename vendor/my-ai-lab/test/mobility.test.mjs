import assert from 'node:assert/strict';
import {mobilityEligible,stepFreeEvidence} from '../public/mobility.js';
import {planOptions,retimeDay} from '../public/planner.js';
assert.equal(stepFreeEvidence({access:{wheel:true,ramp:true}}),false);
assert.equal(stepFreeEvidence({access:{ramp:true,text:{출입구:'주출입구는 턱이 없어 휠체어 접근 가능함'}}}),true);
assert.equal(stepFreeEvidence({access:{ramp:true,text:{출입구:'휠체어 접근 불가'}}}),false);
assert.equal(mobilityEligible({walk:1},{access:['wheelchair']}),false);
assert.equal(mobilityEligible({walk:2},{access:['shortwalk']}),false);
const input={region:'gangneung',date:'2026-11-20',days:2,who:'parents',likes:['sea','culture'],move:'car'};
for(const access of [['shortwalk'],['wheelchair'],['wheelchair','toilet']]){
 const options=planOptions(input,{access,pace:'packed'});
 assert.equal(options.length,3);
 for(const o of options){
  assert.equal(o.opts.pace,'relaxed');
  for(const day of o.trip.days){
   for(const it of day.items)assert.ok(mobilityEligible(it.place,{access}),it.place.name);
   for(let i=1;i<day.items.length;i++)if(day.items[i-1].kind==='visit')assert.ok(day.items[i].start-day.items[i].travelMin-day.items[i-1].end>=20,'rest preserved');
  }
 }
 console.log(access.join('+'),options.map(o=>o.trip.days.flatMap(d=>d.items).length));
}
console.log('PASS: accessibility evidence, three variants, hard filters and rest intervals');

import assert from 'node:assert/strict';
import {mobilityEligible,stepFreeEvidence} from '../public/mobility.js';
import {planOptions,retimeDay,travel} from '../public/planner.js';
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

// Negative/partial entry evidence must win over optimistic structured flags.
for(const text of ['턱이 없음. 내부는 계단만 있음','휠체어 접근 가능, 일부 구간만 가능','휠체어 출입 가능하지만 도움 필요']) {
 assert.equal(stepFreeEvidence({access:{ramp:true,text:{출입구:text}}}),false,text);
}
for(const walk of [undefined,NaN,-1,3])assert.equal(mobilityEligible({walk},{lessWalk:true}),false);
const a={lat:37.75,lng:128.89},b={lat:37.755,lng:128.89};
assert.equal(travel(a,b,'car').mode,'walk');
assert.equal(travel(a,b,'car',{lessWalk:true}).mode,'car');
assert.equal(travel(a,b,'taxi',{access:['wheelchair']}).mode,'taxi');
const c={lat:37.751,lng:128.89};
assert.ok(travel(a,c,'car',{lessWalk:true}).min>=travel(a,c,'car').min);
for(const who of ['parents','family'])for(const o of planOptions({...input,who},{pace:'packed'})) {
 for(const d of o.trip.days)for(const i of d.items){assert.ok(Number.isFinite(i.place.walk)&&i.place.walk<3);assert.ok(!i.place.tags?.includes('night'));}
}
console.log('PASS: contradictory access, unknown walking, shorter walking transfers, parent/child hard exclusions');

assert.equal(mobilityEligible({walk:1,access:{toilet:true,text:{화장실:'장애인 화장실 없음'}}},{access:['toilet']}),false);

const example=planOptions(input,{access:['shortwalk']})[0];
const day=example.trip.days.find(d=>d.items.some(i=>!['walk','same'].includes(i.travelMode)));
assert.ok(day);
for(const invalid of [NaN,Infinity,-1]) {
 const legs=day.items.map(i=>['walk','same'].includes(i.travelMode)?i.travelMin:invalid);
 assert.equal(retimeDay(day,input,example.opts,legs),null);
}
console.log('PASS: invalid road times cannot produce an apparently valid itinerary');

assert.equal(mobilityEligible({walk:1,access:{toilet:true,text:{화장실:'장애인 화장실 있음. 입구 턱 없음'}}},{access:['toilet']}),true);

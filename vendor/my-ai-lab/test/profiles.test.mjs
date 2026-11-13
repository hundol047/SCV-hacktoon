import assert from 'node:assert/strict';
import {planOptions,swapItem,retimeDay} from '../public/planner.js';
import {mobilityEligible} from '../public/mobility.js';
const profiles=[['senior','parents',['shortwalk']],['child','family',['shortwalk']],['wheelchair','parents',['wheelchair']],['stroller','family',['stroller']],['toilet','parents',['wheelchair','toilet']]];
const report=[];
for(const region of ['gangneung','seorak','chuncheon','pyeongchang','wonju'])for(const [name,who,access] of profiles)for(const date of ['2026-11-20','2026-11-21']){
 const input={region,date,days:2,who,likes:['sea','culture','nature'],move:'car'};
 const options=planOptions(input,{access,pace:'packed'});
 assert.equal(options.length,3);
 let stops=0;
 for(const o of options){
  assert.equal(o.opts.pace,'relaxed');
  for(const d of o.trip.days){
   for(const it of d.items){assert.ok(mobilityEligible(it.place,{access}),name+': '+it.place.name);if(who==='family'){assert.notEqual(it.place.walk,3);assert.ok(!it.place.tags?.includes('night'));}stops++;}
   const check=day=>{for(let i=1;i<day.items.length;i++)if(day.items[i-1].kind==='visit')assert.ok(day.items[i].start-day.items[i].travelMin-day.items[i-1].end>=20,'rest interval');};
   check(d);
   const road=retimeDay(d,input,o.opts,d.items.map(it=>it.travelMin+5));if(road)check(road);
  }
  if(o.trip.days[0].items.length){const changed=swapItem(o.trip,input,o.opts,0,0);for(const d of changed.days)for(const it of d.items)assert.ok(mobilityEligible(it.place,{access}));}
 }
 report.push({region,profile:name,date,stops});
}
console.log(JSON.stringify({scenarios:report.length,alternatives:report.length*3,empty:report.filter(r=>!r.stops),checks:'filters, child suitability, swap, delayed roads and rest preserved'},null,2));
const familyOptions=planOptions({region:'gangneung',date:'2026-11-20',days:2,who:'family',likes:['sea','culture'],move:'car'},{access:['shortwalk']});
const signatures=familyOptions.map(o=>o.trip.days.flatMap(d=>d.items.map(i=>i.id)).sort().join('|'));
assert.notEqual(signatures[0],signatures[1],'family alternative must change places, not only their order');
console.log('PASS: family alternative has a different place set');

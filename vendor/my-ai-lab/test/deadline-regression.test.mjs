import assert from 'node:assert/strict';
import {planOptions,planTrip,retimeDay} from '../public/planner.js';
import {halfDocumentDraft} from '../public/half-documents.js';
import {restEvidence,mobilityOptions} from '../public/mobility.js';
let scenarios=0;
for(const region of ['gangneung','chuncheon','seorak','pyeongchang','wonju'])for(const days of [1,2,4])for(const [who,access] of [['parents',['shortwalk']],['family',['shortwalk']],['parents',['wheelchair']]]){
 const input={region,date:'2026-11-19',days,who,likes:['sea','cafe'],move:'car'};
 const options=planOptions(input,{access,pace:'relaxed'}),best=options[0],gentle=options[1];
 assert.ok(gentle.totals.moveMin<=best.totals.moveMin,`${region}: gentle travel`);
 assert.ok(gentle.totals.walkKm<=best.totals.walkKm,`${region}: gentle walking`);
 assert.ok(gentle.places<=best.places,`${region}: gentle visits`);
 const selected=planTrip(input,gentle.opts);
 assert.deepEqual(selected.days.map(d=>d.items.map(i=>i.id)),gentle.trip.days.map(d=>d.items.map(i=>i.id)),'selection must reproduce card');
 for(const option of options)for(const day of option.trip.days){
  const max=days===1?1170:day.dayIdx===days-1?1080:1200;
  assert.ok(day.items.every(i=>i.end<=max),`${region}: end time`);
  const delayed=retimeDay(day,input,option.opts,day.items.map(i=>i.travelMin+30));
  if(delayed)assert.ok(delayed.items.every(i=>i.end<=max),'road retiming must respect limit');
 }
 scenarios++;
}
assert.equal(mobilityOptions({access:['shortwalk'],restMin:40}).restMin,40);
assert.equal(restEvidence({cat:'cafe'}).seat,false,'cafe category is not seat evidence');
assert.deepEqual(restEvidence({access:{toilet:true,text:{시설:'벤치 있음'}}}),{seat:true,toilet:true,stepFree:false});
assert.equal(restEvidence({access:{text:{시설:'벤치 없음'}}}).seat,false);
const draft=halfDocumentDraft({id:'test',title:'반값여행',proofs:['영수증'],link:'https://example.org'}, {date:'2026-11-19'}, {days:[{date:'2026-11-19',items:[{place:{name:'관광지'}}]}]}, {adults:2,kids:1},{'test:영수증':['photo']});
assert.match(draft,/어린이 1명/);assert.match(draft,/영수증: 1장/);assert.match(draft,/방문 완료 증빙이 아님/);assert.match(draft,/적격 판정이 아님/);
console.log(`PASS: ${scenarios} profile/duration/region scenarios, relaxed selection, strict end, rest evidence and half-price drafts`);

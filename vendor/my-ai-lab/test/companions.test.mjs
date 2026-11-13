import assert from 'node:assert/strict';
import {companions,hasCompanion,parseCompanions} from '../public/companions.js';
import {planOptions} from '../public/planner.js';
import {parseSpoken,parseStart} from '../public/voice-parse.js';
import {defaultPeople} from '../public/costs.js';
assert.deepEqual(companions({companions:['solo','parents','family','pet']}),['parents','family','pet']);
assert.equal(hasCompanion({who:'family'},'family'),true);
assert.deepEqual(parseCompanions('아이와 어머니, 강아지랑 여행'),['family','parents','pet']);
assert.deepEqual(parseSpoken('엄마와 아이와 강아지랑 강릉 1박','2026-11-13').input.companions,['family','parents','pet']);
assert.equal(parseStart('서울에서 강릉으로'),null);
assert.equal(parseStart('부산에서 출발'),null);
assert.equal(parseStart('김포에서 출발'),null);
assert.equal(parseStart('서울역에서 출발').name,'서울역');
assert.equal(defaultPeople({who:'parents',companions:['parents','family']}).kids,2);
let checked=0;
for(const region of ['gangneung','seorak','chuncheon','pyeongchang','wonju'])for(const group of [['parents','family'],['family','pet'],['parents','family','pet']]){
 const input={region,date:'2026-11-20',days:2,who:'parents',companions:group,likes:['nature','sea'],move:'car'};
 for(const o of planOptions(input,{access:['shortwalk'],pace:'relaxed'}))for(const d of o.trip.days)for(const i of d.items){
  assert.ok(i.place.walk<=1);assert.ok(!i.place.tags?.includes('night'));
  if(group.includes('pet')){assert.notEqual(i.place.pet,false);assert.ok(i.place.pet||(!i.place.indoor&&!i.place.multi&&['nature','sea'].includes(i.place.cat)));}
  checked++;
 }
}
assert.ok(checked>0);console.log(`PASS: combined companion filters (${checked} stops), voice groups, no inferred city departure`);

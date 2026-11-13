import assert from 'node:assert/strict';
import {restStop} from '../public/rest-plan.js';
const eligible={id:'rest',access:{toilet:true,ramp:true,text:{시설:'벤치 있음',출입구:'턱이 없음'}}};
const prev={place:eligible,end:600},next={place:{id:'next'},travelMin:10,start:640};
const hours=()=>({open:540,close:1020,breaks:[]});
assert.equal(restStop(prev,next,'2026-11-13',{access:['wheelchair']},hours).position,'before');
assert.equal(restStop(prev,next,'2026-11-13',{},()=>({open:540,close:610,breaks:[]})),null);
assert.equal(restStop(prev,next,'2026-11-13',{},()=>({open:540,close:1020,breaks:[[610,650]]})),null);
const after=restStop({place:{id:'unknown'},end:600},{...next,place:eligible},'2026-11-13',{},hours);
assert.equal(after.position,'after');assert.equal(after.start,610);assert.equal(after.end,640);
assert.equal(restStop({place:{cat:'cafe'},end:600},next,'2026-11-13',{},hours),null);
assert.equal(restStop(prev,next,'2026-11-13',{restMin:40},hours),null);
console.log('PASS: rest seating/toilet/entry evidence, arrival time, closing and break times, minimum rest duration');

const unknownPrev={place:{id:'unknown'},end:600};
const confirmed={restConfirmations:{unknown:{seat:true,toilet:true,stepFree:true,checkedAt:Date.now()}}};
assert.equal(restStop(unknownPrev,next,'2026-11-13',confirmed,hours).source,'user');
assert.equal(restStop(unknownPrev,next,'2026-11-13',{restConfirmations:{unknown:{...confirmed.restConfirmations.unknown,checkedAt:Date.now()-8*86400000}}},hours),null);
assert.equal(restStop({place:{access:{toilet:true,text:{'유아 의자':'유아용 보조의자 있음'}}},end:600},next,'2026-11-13',{},hours),null);

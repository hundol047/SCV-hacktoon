import assert from 'node:assert/strict';
const calls=[];
globalThis[Symbol.for('yeohaengit.bedrock.transport')]=async(system,input,schema,name)=>{calls.push(name);return {region:'gangneung',date:'2026-11-14',days:2,who:'parents',likes:['sea'],move:'car',access:['shortwalk'],summary:'부모님과 강릉 여행'};};
const {startFromText}=await import('../vendor/my-ai-lab/ai.mjs');
const r=await startFromText('부모님과 강릉 바다 1박 2일','2026-11-11','ko');
assert.equal(r.who,'parents');assert.deepEqual(calls,['trip_choices']);
globalThis[Symbol.for('yeohaengit.bedrock.transport')]=async()=>({invalid:true});
await assert.rejects(startFromText('여행','2026-11-11','ko'));
console.log('PASS: source AI uses existing Bedrock transport and rejects invalid results');

import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const handlers={};let offline=false;const deleted=[];
const cache={match:async()=>new Response('cached app'),put:async()=>{},addAll:async()=>{}};
vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{
 self:{addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}},skipWaiting:async()=>{}},
 location:{origin:'https://bopok.test'},URL,Promise,
 caches:{open:async()=>cache,keys:async()=>['bopok-old','unrelated-app-cache','ohneul-gangwon-media-v1'],delete:async key=>deleted.push(key)},
 fetch:async()=>{if(offline)throw Error('offline');return new Response('fresh app');},
});
async function visit(){let reply;const pending=[];handlers.fetch({request:{method:'GET',url:'https://bopok.test/lab/style.css'},respondWith:p=>reply=p,waitUntil:p=>pending.push(p)});const response=await reply;await Promise.all(pending);return response.text();}
assert.equal(await visit(),'fresh app');offline=true;assert.equal(await visit(),'cached app');
let activation;handlers.activate({waitUntil:p=>activation=p});await activation;assert.deepEqual(deleted,['bopok-old']);
console.log('PASS: online fresh shell, offline fallback, unrelated caches retained');

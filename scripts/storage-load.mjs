import {randomUUID} from 'node:crypto';
const base=process.env.BOPok_LOAD_URL,workers=Number(process.env.BOPok_LOAD_CONCURRENCY??10);
const conditions={activity:'unknown',maxWalkMin:null,maxWalkM:null,restInterval:null,restMin:null,avoidStairs:false,foodLikes:[],foodAvoids:[],experiences:[],requiredExperiences:[],avoidSituations:[],latestLunch:null};
const timings=[];let requests=0,finished=0;
async function call(path,{cookie,cap,method='GET',body,expected=200}={}){const start=performance.now(),r=await fetch(new URL(path,base),{method,headers:{Origin:new URL(base).origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(cap?{Authorization:'Bearer '+cap}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});timings.push(performance.now()-start);requests++;if(r.status!==expected)throw Error('Isolated storage flow failed ('+r.status+').');return {data:await r.json(),cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};}
try{
 if(!base||process.env.BOPok_LOAD_ALLOW_WRITES!=='true'||!Number.isInteger(workers)||workers<1||workers>40)throw Error('Set a dedicated test URL, explicit write opt-in and concurrency 1–40.');
 await Promise.all(Array.from({length:workers},async()=>{
  const session=await call('/api/session',{method:'POST',body:{}}),cookie=session.cookie;
  const trip={version:1,id:'isolated-load-'+randomUUID(),revision:0,conditions,basics:{title:'격리 부하 검사',region:'가상 솔바다',date:'2030-10-17',days:1,budget:100000,transport:'taxi',mode:'demo',timezone:'Asia/Seoul'},items:[],history:[],feedback:[]};
  let id;
  try{
   const created=await call('/api/trips',{cookie,method:'POST',body:trip,expected:201});id=created.data.id;
   const link=await call('/api/trips/'+id,{cookie,method:'POST',body:{action:'invite',role:'viewer'}}),cap=new URLSearchParams(link.data.fragment).get('token');
   trip.revision++;trip.basics.title='격리 수정 완료';await call('/api/trips/'+id,{cookie,method:'PUT',body:{trip,storageVersion:created.data.storageVersion}});
   const shared=await call('/api/trips/'+id,{cap});if(shared.data.trip.basics.title!==trip.basics.title)throw Error('Shared read lost an update.');
   await call('/api/trips/'+id,{cap,method:'POST',body:{action:'feedback',text:'좋아요'}});
   const updated=await call('/api/trips/'+id,{cookie});if(!updated.data.trip.feedback.some(f=>f.text==='좋아요'))throw Error('Feedback was lost.');
   await call('/api/trips/'+id,{cap,method:'PUT',body:{trip,storageVersion:updated.data.storageVersion},expected:403});
   await call('/api/trips/'+id,{cookie,method:'PUT',body:{trip,storageVersion:created.data.storageVersion},expected:409});
   await call('/api/trips/'+id,{cookie,method:'POST',body:{action:'revoke'}});
   await call('/api/trips/'+id,{cap,expected:403});finished++;
  }finally{if(id)await call('/api/trips/'+id,{cookie,method:'DELETE'});}
 }));
 timings.sort((a,b)=>a-b);const p95=Math.round(timings[Math.ceil(timings.length*.95)-1]);console.log(JSON.stringify({concurrentOwners:workers,completedJourneys:finished,requests,p95ms:p95,paidCalls:0,ownTripsRemoved:true,checks:['create','update','shared-read','feedback','viewer-denial','conflict','revoke','delete']}));if(p95>3000)throw Error('Isolated storage p95 exceeds 3 seconds.');
}catch(error){console.error(error.message);process.exitCode=1;}

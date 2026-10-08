import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
/** @param {string} origin @param {string} secret @param {{fetcher?:typeof fetch,webhook?:string,state?:Record<string,number>,now?:number}} [options] */
export async function monitor(origin,secret,{fetcher=fetch,webhook=undefined,state={},now=Date.now()}={}){
 const base=new URL(origin);if(base.protocol!=='https:'||base.username||base.password||!secret||secret.length<32)throw Error('HTTPS origin and operational credentials required.');
 let issues=[],appAlert=false;
 try{const r=await fetcher(new URL('/api/ops',base),{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({action:'check'}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const d=await r.json();issues=d.issues??d.readiness.missing??[];appAlert=d.alert?.sent===true;if(!d.readiness.ready&&!issues.length)issues=['app_unready'];}catch{issues=['app_unreachable'];}
 issues=issues.filter(v=>typeof v==='string'&&/^[a-z0-9_]{1,50}$/.test(v)).sort();
 if(!issues.length)return {ready:true,issues,alert:'healthy',state};
 const signature=issues.join(','),last=state[signature]??0;
 if(appAlert)return {ready:false,issues,alert:'app_delivered',state:{...state,[signature]:now}};
 if(now-last<1800000)return {ready:false,issues,alert:'cooldown',state};
 if(!webhook)return {ready:false,issues,alert:'external_webhook_missing',state};
 const url=new URL(webhook);if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid external alert endpoint');
 try{const r=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Bopok external monitor',codes:issues,checkedAt:new Date(now).toISOString()}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return {ready:false,issues,alert:'external_delivered',state:{...state,[signature]:now}};}catch{return {ready:false,issues,alert:'external_delivery_failed',state};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const file=process.env.BOPok_MONITOR_STATE??'/tmp/bopok-monitor-state.json';let state={};try{state=JSON.parse(await readFile(file,'utf8'));}catch{}const result=await monitor(process.env.BOPok_DEPLOY_URL,process.env.BOPok_OPS_SECRET,{webhook:process.env.BOPok_ALERT_WEBHOOK_URL,state});await writeFile(file,JSON.stringify(result.state),{mode:0o600});console.log(JSON.stringify({ready:result.ready,issues:result.issues,alert:result.alert}));if(!result.ready)process.exitCode=1;}catch{console.error('External monitoring configuration or request failed.');process.exitCode=1;}}

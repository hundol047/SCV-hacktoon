const base=process.env.BOPok_DEPLOY_URL;
if(!base)throw Error('Set BOPok_DEPLOY_URL to the deployed HTTPS origin.');
const origin=new URL(base);if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.username||origin.password)throw Error('HTTPS origin required.');
const home=await fetch(origin,{signal:AbortSignal.timeout(20000)});if(!home.ok||!(await home.text()).includes('보폭'))throw Error('Homepage failed');
const status=await fetch(new URL('/api/status',origin),{signal:AbortSignal.timeout(15000)});if(!status.ok)throw Error('Status failed');const config=await status.json();
const rules=await fetch(new URL('/api/conditions',origin),{method:'POST',headers:{'Content-Type':'application/json',Origin:origin.origin},body:JSON.stringify({text:'한 번에 20분',consent:false}),signal:AbortSignal.timeout(15000)});const result=await rules.json();if(!rules.ok||result.status!=='rules'||result.output.maxWalkMin!==20)throw Error('Rule extraction failed');
console.log(JSON.stringify({homepage:'passed',rules:'passed',storageConnected:config.storage.connected,sessionConfigured:config.storage.sessionConfigured,aiConfigured:config.ai.configured,routeConfigured:config.realData.routeConfigured}));

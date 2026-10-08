// Public, read-only release gate. No keys, links, trips or paid calls are created.
export async function probe(base,fetcher=fetch,{required=true,expectedRelease}={}){
 const origin=new URL(base);if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.username||origin.password)throw Error('HTTPS origin required.');
 const home=await fetcher(origin,{signal:AbortSignal.timeout(20000)});if(!home.ok||!(await home.text()).includes('보폭'))throw Error('Homepage failed');
 const ready=await fetcher(new URL('/api/health',origin),{signal:AbortSignal.timeout(20000)}),state=await ready.json();if(required&&(!ready.ok||!state.ready))throw Error('Release prerequisites missing: '+(state.missing??['health_failed']).join(','));
 if(expectedRelease&&state.release!==expectedRelease)throw Error('Deployment release identity mismatch');
 const rules=await fetcher(new URL('/api/conditions',origin),{method:'POST',headers:{'Content-Type':'application/json',Origin:origin.origin},body:JSON.stringify({text:'한 번에 20분',consent:false}),signal:AbortSignal.timeout(15000)}),result=await rules.json();if(!rules.ok||result.status!=='rules'||result.output.maxWalkMin!==20)throw Error('Rule extraction failed');
 return {homepage:'passed',rules:'passed',ready:state.ready,missing:state.missing??[]};
}
if(process.argv[1]?.endsWith('probe-deployment.mjs')){if(!process.env.BOPok_DEPLOY_URL)throw Error('Set BOPok_DEPLOY_URL to the deployed HTTPS origin.');console.log(JSON.stringify(await probe(process.env.BOPok_DEPLOY_URL,fetch,{required:!process.argv.includes('--demo')})));}

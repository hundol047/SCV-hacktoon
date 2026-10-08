import {OpenAIProvider} from '../adapters/ai';
import {OpenRouteProvider} from '../adapters/real-data';
import {TransitProvider} from '../adapters/transit';
import {exchangeRates} from './world-data';
import {providerNames,providerFingerprint,type ProviderName} from './provider-state';
import {TripStore,type RPC} from './store';
import {measure} from './metrics';
export async function probeProviders(rpc:RPC,{paid=false,fetcher=fetch,only=providerNames}:{paid?:boolean;fetcher?:typeof fetch;only?:readonly ProviderName[]}={}){
 const results:{name:ProviderName;ok:boolean;code:string}[]=[];
 for(const name of only){
  if(['ai','routing','transit'].includes(name)&&!paid)continue;
  let ok=false,code='failed';
  try{
   await measure(name==='ai'?'ai':name==='auth'||name==='bot'?'auth':name==='routing'||name==='transit'?'routing':'catalog',async()=>{
    if(name==='auth'){if(!process.env.BOPok_SUPABASE_URL||!process.env.BOPok_SUPABASE_ANON_KEY)throw Error('missing');const r=await fetcher(process.env.BOPok_SUPABASE_URL.replace(/\/$/,'')+'/auth/v1/settings',{headers:{apikey:process.env.BOPok_SUPABASE_ANON_KEY},signal:AbortSignal.timeout(10000)});if(!r.ok||(await r.json()).external?.email!==true)throw Error('auth_rejected');}
    else if(name==='bot'){if(!process.env.BOPok_TURNSTILE_SECRET)throw Error('missing');const r=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:process.env.BOPok_TURNSTILE_SECRET,response:'bopok-invalid-probe-token'}),signal:AbortSignal.timeout(10000)}),d=await r.json();if(!r.ok||!(d['error-codes']??[]).includes('invalid-input-response')||(d['error-codes']??[]).includes('invalid-input-secret'))throw Error('bot_rejected');}
    else if(name==='ai'){
     const key=process.env.BOPok_AI_KEY,model=process.env.BOPok_AI_MODEL,input=Number(process.env.BOPok_AI_INPUT_USD_PER_MILLION),output=Number(process.env.BOPok_AI_OUTPUT_USD_PER_MILLION);
     if(!key||!model||!Number.isFinite(input)||input<=0||!Number.isFinite(output)||output<=0)throw Error('missing');
     const budget=await new TripStore(rpc).reserve(providerFingerprint('ai'),{scope:'ai',tokens:19200,cost:(18000*input+1200*output)/1000000,minuteLimit:1,dailyRequests:Number(process.env.BOPok_AI_DAILY_REQUEST_LIMIT??30),dailyTokens:Number(process.env.BOPok_AI_DAILY_TOKEN_LIMIT??200000),dailyCost:Number(process.env.BOPok_AI_DAILY_USD_LIMIT??1)});if(!budget.allowed)throw Error('budget');
     const d=await new OpenAIProvider(key,model,fetcher).extract('한 번에 20분');if(d.maxWalkMin!==20)throw Error('ai_schema');
    }else if(name==='routing'||name==='transit'){
     const key=process.env[name==='routing'?'BOPok_ROUTE_KEY':'BOPok_GOOGLE_MAPS_KEY'];if(!key)throw Error('missing');
     const from={id:'probe-from',latitude:37.5665,longitude:126.978} as any,to={id:'probe-to',latitude:37.5707,longitude:126.9769} as any;
     if(name==='routing')await new OpenRouteProvider(key,fetcher).route(from,to,'walk');else await new TransitProvider(key,fetcher).route(from,to,new Date(Date.now()+86400000).toISOString());
    }else if(name==='fx')await exchangeRates(fetcher);
    else{
     if(!(await rpc.call('bopok_geo_guard',{p_provider:'nominatim'})).allowed||!(await rpc.call('bopok_geo_guard',{p_provider:'overpass'})).allowed)throw Error('busy');
     const headers={'User-Agent':'Bopok/0.4 (+https://github.com/hundol047/SCV-hacktoon)'},r=await fetcher('https://nominatim.openstreetmap.org/search?q=Seoul&format=jsonv2&limit=1',{headers,signal:AbortSignal.timeout(10000)}),locations=await r.json();if(!r.ok||!locations[0]||!Number.isFinite(Number(locations[0].lat))||!Number.isFinite(Number(locations[0].lon)))throw Error('geocode');
     const places=await fetcher('https://overpass-api.de/api/interpreter',{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:`[out:json][timeout:10];nwr(around:500,${locations[0].lat},${locations[0].lon})["tourism"="museum"];out center 1;`}),signal:AbortSignal.timeout(15000)});if(!places.ok||!Array.isArray((await places.json()).elements))throw Error('places');
    }
   },rpc);ok=true;code='ok';
  }catch(error){const message=error instanceof Error?error.message:'';code=['missing','budget','busy'].includes(message)?message:'failed';}
  await rpc.call('bopok_provider',{p_action:'record',p_name:name,p_fingerprint:providerFingerprint(name),p_ok:ok,p_code:code});results.push({name,ok,code});
 }
 return results;
}

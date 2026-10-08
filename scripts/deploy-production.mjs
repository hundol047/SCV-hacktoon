import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {probe} from './probe-deployment.mjs';
/** @param {{origin:string,token:string,org?:string,release?:string,fetcher?:typeof fetch,run:(args:string[])=>Promise<string>}} options */
export async function deployProduction({origin,token,org=undefined,release=undefined,fetcher=fetch,run}){
 const target=new URL(origin);if(target.protocol!=='https:'||target.username||target.password||target.pathname!=='/'||!token)throw Error('Production HTTPS origin and Vercel credentials required.');
 const lookup=new URL('https://api.vercel.com/v13/deployments/'+encodeURIComponent(target.hostname));if(org?.startsWith('team_'))lookup.searchParams.set('teamId',org);
 const response=await fetcher(lookup,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});if(!response.ok&&response.status!==404)throw Error('Previous deployment lookup failed; live deployment was not changed.');
 const previous=response.ok?await response.json():null,previousId=previous?.id??previous?.uid;
 if(previous&&!previousId)throw Error('Previous deployment identity unavailable.');
 const candidate=(await run(['deploy','--prebuilt','--prod','--skip-domain',...(release?['--env','BOPok_RELEASE_ID='+release]:[])])).trim();
 const candidateURL=new URL(candidate);if(candidateURL.protocol!=='https:'||!candidateURL.hostname.endsWith('.vercel.app'))throw Error('Invalid deployment candidate URL.');
 await probe(candidate,fetcher,{expectedRelease:release});
 try{
  // A failed promotion command may still have changed aliases, so restore on any failure.
  await run(['promote',candidate,'--yes']);await probe(target.origin,fetcher,{expectedRelease:release});
  return {verified:true,promoted:true,previousDeployment:!!previousId};
 }catch{
  if(previousId){try{await run(['promote',previousId,'--yes']);await probe(target.origin,fetcher);}catch{throw Error('Production verification failed and rollback failed; operator intervention required.');}throw Error('Production verification failed; previous deployment restored and checked.');}
  throw Error('First production verification failed; no previous deployment exists to restore.');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const token=process.env.VERCEL_TOKEN;
 const run=args=>new Promise((resolve,reject)=>{const child=spawn('npx',['--yes','vercel@63.1.0',...args,'--token',token],{stdio:['ignore','pipe','ignore']}),chunks=[];child.stdout.on('data',b=>chunks.push(b));child.on('error',()=>reject(Error('Vercel CLI unavailable')));child.on('exit',c=>c===0?resolve(Buffer.concat(chunks).toString()):reject(Error('Vercel command failed')));});
 try{console.log(JSON.stringify(await deployProduction({origin:process.env.BOPok_APP_URL,token,org:process.env.VERCEL_ORG_ID,release:process.env.BOPok_RELEASE_ID,run})));}catch(error){console.error(error.message);process.exitCode=1;}
}

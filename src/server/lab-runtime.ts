import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {converseJSON} from './bedrock';
const globals=globalThis as typeof globalThis & {__labRuntime?:Promise<{port:number;ai:any}>};
export function labRuntime(){
 return globals.__labRuntime??=(async()=>{
  (globalThis as any)[Symbol.for('yeohaengit.bedrock.transport')]=(system:string,input:string,schema:Record<string,unknown>,name:string)=>converseJSON(system,input,schema,name,3500);
  const root=path.join(process.cwd(),'vendor/my-ai-lab');
  const nativeImport=new Function('url','return import(url)') as (url:string)=>Promise<any>;
  const {server}=await nativeImport(pathToFileURL(path.join(root,'server.mjs')).href);
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  server.unref();return {port:server.address().port,ai:await nativeImport(pathToFileURL(path.join(root,'ai.mjs')).href)};
 })().catch(error=>{globals.__labRuntime=undefined;throw error;});
}

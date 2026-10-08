import {configuredRPC,type RPC} from './store';
export async function measure<T>(event:'auth'|'ai'|'routing'|'catalog',work:()=>Promise<T>,rpc:RPC|null=configuredRPC()):Promise<T>{
 const start=Date.now();let ok=false;
 try{const result=await work();ok=true;return result;}finally{try{await rpc?.call('bopok_metric',{p_event:event,p_code:ok?'ok':'failed',p_value:Math.min(10000000,Date.now()-start)});}catch{/* Metrics must not change the user's result. */}}
}

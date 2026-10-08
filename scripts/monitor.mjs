// Compatibility entry point for the independently running monitor.
import {monitor} from './external-monitor.mjs';
try{const result=await monitor(process.env.BOPok_DEPLOY_URL,process.env.BOPok_OPS_SECRET,{webhook:process.env.BOPok_ALERT_WEBHOOK_URL});console.log(JSON.stringify({ready:result.ready,issues:result.issues,alert:result.alert}));if(!result.ready)process.exitCode=1;}catch{console.error('External monitoring unavailable.');process.exitCode=1;}

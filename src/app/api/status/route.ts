import {configuredRPC} from '../../../server/store';
import {json} from '../../../server/security';
export async function GET(){const rpc=configuredRPC();let connected=false;if(rpc)try{connected=(await rpc.call('bopok_trip',{p_action:'health'})).ready===true;}catch{}
  return json({storage:{configured:!!rpc,connected,sessionConfigured:(process.env.BOPok_SESSION_SECRET?.length??0)>=32},ai:{configured:!!(process.env.BOPok_AI_KEY&&process.env.BOPok_AI_MODEL),budgetConfigured:!!(connected&&process.env.BOPok_AI_INPUT_USD_PER_MILLION&&process.env.BOPok_AI_OUTPUT_USD_PER_MILLION)},realData:{configured:!!process.env.BOPok_APP_URL,routeConfigured:!!process.env.BOPok_ROUTE_KEY},version:'0.2.0'});
}

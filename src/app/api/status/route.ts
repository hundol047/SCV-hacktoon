import {inspectStorage} from '../../../server/readiness';
import {json} from '../../../server/security';
import {appURL} from '../../../server/config';
export async function GET(){const storage=await inspectStorage();return json({storage,ai:{configured:!!(process.env.BOPok_AI_KEY&&process.env.BOPok_AI_MODEL),budgetConfigured:!!(storage.ready&&process.env.BOPok_AI_INPUT_USD_PER_MILLION&&process.env.BOPok_AI_OUTPUT_USD_PER_MILLION)},realData:{configured:!!appURL(),routeConfigured:!!process.env.BOPok_ROUTE_KEY},version:'0.5.0'});}

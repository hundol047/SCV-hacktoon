import {readiness} from '../../../server/readiness';
import {json} from '../../../server/security';
export async function GET(request:Request){if(new URL(request.url).searchParams.get('level')==='live')return json({live:true});const state=await readiness();return json(state,state.ready?200:503);}

import {readiness} from '../../../server/readiness';
import {json} from '../../../server/security';
export async function GET(request:Request){if(new URL(request.url).searchParams.get('level')==='live')return json({live:true});const state=await readiness();return json({...state,release:process.env.BOPok_RELEASE_ID??process.env.VERCEL_GIT_COMMIT_SHA??'local'},state.ready?200:503);}

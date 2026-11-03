import {createBedrockClient,converseJSON,BedrockReplyError} from '../src/server/bedrock';
import {courseReplySchema,courseInstructions} from '../src/domain/regional-course';
import {z} from 'zod';
async function main(){
const client=createBedrockClient();
try{
 const credentials=await client.config.credentials();
 if(!credentials.accessKeyId||!credentials.secretAccessKey||!credentials.sessionToken||!credentials.expiration)throw Error('Temporary instance-role credentials missing');
 console.log('EC2 IMDSv2 temporary role credentials resolved; no credential values logged.');
 if(process.argv.includes('--converse')){
  const schema=z.toJSONSchema(courseReplySchema);delete schema.$schema;
  const result=courseReplySchema.parse(await converseJSON(courseInstructions,JSON.stringify({region:'연결 검사',candidates:[{id:'probe-a',name:'공원'},{id:'probe-b',name:'박물관'}]}),schema,'course',1600,client));
  if(result.candidateIds.length!==2||new Set(result.candidateIds).size!==2||result.candidateIds.some(id=>!['probe-a','probe-b'].includes(id)))throw Error('Course validation failed');
  console.log('Bedrock course JSON generation and candidate validation succeeded.');
 }
}catch(e){console.error('Probe failure category:',e instanceof BedrockReplyError?e.code:e instanceof Error?e.name:'unknown');console.error('IAM/Bedrock validation failed. Check server AWS_REGION, instance profile permissions, IMDSv2 access and Docker metadata hop limit (2). No static-key fallback is used.');process.exitCode=1;}finally{client.destroy();}

}
main().catch(()=>{console.error("IAM verification could not start: server region is missing.");process.exitCode=1;});

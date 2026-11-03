import {createBedrockClient,BEDROCK_MODEL} from '../src/server/bedrock';
import {ConverseCommand} from '@aws-sdk/client-bedrock-runtime';
async function main(){
const client=createBedrockClient();
try{
 const credentials=await client.config.credentials();
 if(!credentials.accessKeyId||!credentials.secretAccessKey||!credentials.sessionToken||!credentials.expiration)throw Error('Temporary instance-role credentials missing');
 console.log('EC2 IMDSv2 temporary role credentials resolved; no credential values logged.');
 if(process.argv.includes('--converse')){
  const result=await client.send(new ConverseCommand({modelId:BEDROCK_MODEL,messages:[{role:'user',content:[{text:'Reply OK.'}]}],inferenceConfig:{maxTokens:16}}),{abortSignal:AbortSignal.timeout(30000)});
  if(result.stopReason!=='end_turn'||!result.output?.message?.content?.some(b=>typeof b.text==='string'))throw Error('Converse validation failed');
  console.log('Bedrock Converse succeeded with the configured server region and fixed model.');
 }
}catch{console.error('IAM/Bedrock validation failed. Check server AWS_REGION, instance profile permissions, IMDSv2 access and Docker metadata hop limit (2). No static-key fallback is used.');process.exitCode=1;}finally{client.destroy();}

}
main().catch(()=>{console.error("IAM verification could not start: server region is missing.");process.exitCode=1;});

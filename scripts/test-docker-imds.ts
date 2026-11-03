// Local IMDS/Bedrock stand-ins, never a claim of EC2/server verification.
import {createServer} from 'node:http';
import {createServer as createHttp2Server} from 'node:http2';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createBedrockClient,BEDROCK_MODEL} from '../src/server/bedrock';
import {ConverseCommand} from '@aws-sdk/client-bedrock-runtime';
async function main(){
 let tokenRequests=0,roleRequests=0,converseRequests=0,denyToken=false;
 const roleKey='ASIASYNTHETICROLEONLY',token='synthetic-imds-v2-token';
 const handler=async(req:any,res:any)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/latest/api/token'){tokenRequests++;res.statusCode=denyToken?403:200;res.end(denyToken?'denied':token);return;}
  if(req.url?.startsWith('/latest/meta-data/iam/security-credentials/')){
   if(req.headers['x-aws-ec2-metadata-token']!==token){res.statusCode=401;res.end('{}');return;}
   roleRequests++;
   if(req.url.endsWith('/'))res.end('synthetic-ec2-role');
   else res.end(JSON.stringify({Code:'Success',AccessKeyId:roleKey,SecretAccessKey:'synthetic-secret-not-real',Token:'synthetic-session-not-real',Expiration:new Date(Date.now()+3600000).toISOString()}));return;
  }
  if(req.url?.endsWith('/converse')){
   let body='';for await(const part of req)body+=part;
   assert.match(req.headers.authorization??'',new RegExp(roleKey));assert.doesNotMatch(req.headers.authorization??'',/STATICENV/);assert.equal(req.headers['x-amz-security-token'],'synthetic-session-not-real');assert.match(decodeURIComponent(req.url),new RegExp(BEDROCK_MODEL));assert.equal(JSON.parse(body).messages[0].role,'user');
   converseRequests++;res.end(JSON.stringify({stopReason:'end_turn',output:{message:{role:'assistant',content:[{text:'OK'}]}},usage:{inputTokens:1,outputTokens:1,totalTokens:2},metrics:{latencyMs:1}}));return;
  }
  res.statusCode=404;res.end('{}');
 };
 const server=createServer(handler),bedrock=createHttp2Server(handler);
 server.listen(0,'127.0.0.1');await once(server,'listening');bedrock.listen(0,'127.0.0.1');await once(bedrock,'listening');
 const endpoint=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 Object.assign(process.env,{AWS_REGION:'ap-southeast-2',AWS_ACCESS_KEY_ID:'STATICENV',AWS_SECRET_ACCESS_KEY:'STATICENV',AWS_EC2_METADATA_SERVICE_ENDPOINT:endpoint});
 try{
  const client=createBedrockClient();client.config.endpointProvider=()=>({url:new URL(`http://127.0.0.1:${(bedrock.address() as {port:number}).port}`)});
  const result=await client.send(new ConverseCommand({modelId:BEDROCK_MODEL,messages:[{role:'user',content:[{text:'OK'}]}],inferenceConfig:{maxTokens:16}}));client.destroy();assert.equal(result.stopReason,'end_turn');assert.equal(converseRequests,1);assert.ok(tokenRequests>0&&roleRequests>=2);
  denyToken=true;const denied=createBedrockClient();await assert.rejects(denied.config.credentials());denied.destroy();
  console.log('PASS: Docker IMDSv2 role retrieval, SigV4 Converse, environment-key exclusion and fail-closed when IMDSv2 is denied (all endpoints synthetic).');
 }finally{server.close();bedrock.close();}
}
main().catch(error=>{console.error('FAIL: synthetic Docker IMDSv2/Converse verification',error);process.exitCode=1;});

// Read-only diagnostic: never print keys, request URLs or raw provider errors.
const key=process.env.BOPok_VWORLD_KEY?.trim();
if(!key){console.error('KEY_MISSING: 현재 앱 컨테이너에 VWorld 키가 없습니다.');process.exit(1);}
const domain=process.env.BOPok_VWORLD_DOMAIN?.trim()||process.env.BOPok_APP_URL?.trim();
console.log('KEY_PRESENT: YES');
console.log('DOMAIN_SETTING: '+(domain?'PRESENT':'MISSING'));
const safeCodes=new Set(['ENOTFOUND','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH','ECONNREFUSED','ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_SOCKET','CERT_HAS_EXPIRED','CERT_NOT_YET_VALID','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_TLS_CERT_ALTNAME_INVALID']);
function codes(error){const found=new Set();const walk=(e,depth=0)=>{if(!e||depth>5)return;if(safeCodes.has(e.code))found.add(e.code);if(e.name==='TimeoutError'||e.name==='AbortError')found.add('REQUEST_TIMEOUT');walk(e.cause,depth+1);if(Array.isArray(e.errors))for(const child of e.errors)walk(child,depth+1);};walk(error);return [...found];}
const started=Date.now();
try{
 const params=new URLSearchParams({service:'search',request:'search',version:'2.0',crs:'EPSG:4326',size:'5',page:'1',query:'태원고등학교',type:'place',format:'json',errorformat:'json',key,...(domain?{domain}:{})});
 const response=await fetch('https://api.vworld.kr/req/search?'+params,{signal:AbortSignal.timeout(12000),redirect:'manual'});
 console.log('HTTP_STATUS: '+response.status);
 if(response.status>=300&&response.status<400){console.error('REDIRECT: API 주소가 다른 주소로 이동을 요구합니다. 인증키 보호를 위해 따라가지 않았습니다.');process.exitCode=1;}
 else{
  const body=await response.text();let data;
  try{data=JSON.parse(body);}catch{console.error('NON_JSON_RESPONSE: API가 JSON 대신 다른 형식을 반환했습니다. 응답 본문은 출력하지 않습니다.');process.exitCode=1;}
  if(data){const result=data.response;const status=['OK','NOT_FOUND','ERROR'].includes(result?.status)?result.status:'UNKNOWN';console.log('API_STATUS: '+status);
   if(response.ok&&status==='OK'&&Array.isArray(result.result?.items)&&result.result.items.some(p=>Number(p.point?.x)>=123&&Number(p.point?.x)<=133&&Number(p.point?.y)>=30&&Number(p.point?.y)<=40))console.log('VWorld 검색 API 연결 성공. 국내 장소 좌표 응답을 확인했습니다.');
   else if(response.ok&&status==='NOT_FOUND')console.log('검색 요청은 처리됐지만 검사 장소의 결과가 없습니다.');
   else{const code=String(result?.error?.code??'');const known=new Set(['INVALID_KEY','INCORRECT_KEY','INVALID_DOMAIN','INVALID_REQUEST','INVALID_PARAMETER','INVALID_TYPE','INVALID_SERVICE','INVALID_VERSION','REQUEST_LIMIT_EXCEEDED','LIMIT_EXCEEDED','UNAUTHORIZED','PERMISSION_DENIED','OVER_QUERY_LIMIT']);console.error('API_ERROR_CODE: '+(known.has(code)?code:'UNKNOWN_API_ERROR'));console.error('검색 API 권한과 발급 시 등록한 서비스 URL을 확인하세요.');process.exitCode=1;}
  }
 }
}catch(error){const list=codes(error);console.error('CONNECTION_ERROR: '+(list.length?list.join(', '):'UNKNOWN_NETWORK_ERROR'));if(list.some(c=>/CERT|ISSUER|SIGNATURE/.test(c)))console.error('TLS 인증서 검증 실패입니다. 인증서 검증을 끄거나 HTTP로 키를 보내지 마세요.');else if(list.some(c=>/TIMEOUT|TIMEDOUT|UNREACH/.test(c)))console.error('서버에서 api.vworld.kr:443 연결이 지연되거나 차단되는지 확인이 필요합니다.');else if(list.some(c=>c==='ENOTFOUND'||c==='EAI_AGAIN'))console.error('서버 DNS에서 api.vworld.kr 이름을 확인하지 못했습니다.');process.exitCode=1;}
finally{console.log('ELAPSED_MS: '+(Date.now()-started));}

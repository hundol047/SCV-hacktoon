// Run inside the app container: node --input-type=module < this file.
// Prints status only; never prints keys, request URLs, or provider error messages.
const key=process.env.BOPok_VWORLD_KEY?.trim();
if(!key){console.error('VWorld 키가 현재 앱 컨테이너에 없습니다. 저장 후 재배포가 필요합니다.');process.exit(1);}
const domain=process.env.BOPok_VWORLD_DOMAIN?.trim()||process.env.BOPok_APP_URL?.trim();
try{
 const params=new URLSearchParams({service:'search',request:'search',version:'2.0',crs:'EPSG:4326',size:'5',page:'1',query:'태원고등학교',type:'place',format:'json',errorformat:'json',key,...(domain?{domain}:{})});
 const response=await fetch('https://api.vworld.kr/req/search?'+params,{signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Error();
 const result=(await response.json())?.response;
 if(result?.status==='OK'&&Array.isArray(result.result?.items)&&result.result.items.some(p=>Number(p.point?.x)>=123&&Number(p.point?.x)<=133&&Number(p.point?.y)>=30&&Number(p.point?.y)<=40))console.log('VWorld 검색 API 연결 성공. 국내 장소 좌표 응답을 확인했습니다.');
 else if(result?.status==='NOT_FOUND')console.log('VWorld 요청은 처리됐지만 검사 장소의 검색 결과가 없습니다.');
 else {const code=String(result?.error?.code??'');console.error('VWorld 인증 또는 요청 실패. 검색 API 사용 권한과 등록 서비스 URL을 확인하세요.'+(/^[A-Z0-9_]{1,60}$/.test(code)?' 오류 코드: '+code:''));process.exitCode=1;}
}catch{console.error('VWorld 연결 검사 실패. 서버 네트워크와 API 설정을 확인하세요. 인증키는 출력하지 않았습니다.');process.exitCode=1;}

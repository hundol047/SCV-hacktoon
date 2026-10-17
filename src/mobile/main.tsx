import React from 'react';
import {createRoot} from 'react-dom/client';
import Bopok from '../components/Bopok';
import {koreaCatalog,searchKorea} from '../data/korea-catalog';
import type {KoreaSnapshot} from '../data/korea-tourism';
import '../app/globals.css';
import './mobile.css';

declare global {interface Window {BopokAndroid?:{saveJson:(name:string,data:string)=>void;saveTourism:()=>void;printPage:()=>void;aiStatus:()=>string;configureAI:(key:string,model:string)=>void;requestAI:(id:string,input:string)=>void};}}
const nativeFetch=window.fetch.bind(window);
let snapshot:Promise<KoreaSnapshot>|undefined;
async function readSnapshot(){
  if(!snapshot) snapshot=(async()=>{
    const response=await nativeFetch('/snapshot.json.gz');
    if(!response.ok||!response.body)throw Error('내장 관광 자료를 읽지 못했습니다.');
    if(typeof DecompressionStream==='undefined')throw Error('Android System WebView를 업데이트한 뒤 다시 실행해 주세요.');
    return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json() as KoreaSnapshot;
  })().catch(e=>{snapshot=undefined;throw e;});
  return snapshot;
}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
window.fetch=async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href);
  if(url.origin!==location.origin)return json({error:'외부 연결은 휴대폰 브라우저에서 열어 주세요.'},503);
  if(url.pathname==='/api/status')return json({storage:{connected:false,ready:false,sessionConfigured:false}});
  if(url.pathname==='/api/account')return json({configured:false,authenticated:false});
  if(url.pathname==='/api/tourism'){
    try{
      const s=await readSnapshot(),p=url.searchParams,province=p.get('province')??'',q=p.get('q')??'';
      if(p.get('action')==='catalog')return json(koreaCatalog(s,province,q,200));
      return json({...searchKorea(s,q,province,p.get('category')??'',Math.max(1,Number(p.get('page'))||1),25),dataset:{total:s.records.length,collectedAt:s.collectedAt,coverage:s.coverage,stale:Date.now()-Date.parse(s.collectedAt)>7*86400000,missingNames:s.records.filter(r=>!r.nameKnown).length,missingCoordinates:s.records.filter(r=>r.latitude===null||r.longitude===null).length,missingAddresses:s.records.filter(r=>!r.address.trim()).length,notice:'앱에 포함된 OSM 수집 자료입니다. 실시간 운영정보와 미등록 장소의 전수 자료가 아닙니다.'}});
    }catch(e){return json({error:e instanceof Error?e.message:'내장 자료 검색 실패'},503);}
  }
  if(url.pathname.startsWith('/api/'))return json({error:'이 APK는 오프라인 버전입니다. 전국 수집 자료와 로컬 일정 기능을 이용해 주세요. 로그인·AI·실시간 조회·서버 공유는 연결되지 않았습니다.'},503);
  return nativeFetch(input,init);
};
if(window.BopokAndroid){
  window.print=()=>window.BopokAndroid!.printPage();
  document.addEventListener('click',event=>{
    const anchor=(event.target as Element)?.closest?.('a');
    if(anchor?.getAttribute('href')==='/api/tourism/download'){event.preventDefault();window.BopokAndroid!.saveTourism();}
  });
}
createRoot(document.getElementById('root')!).render(<><aside className="mobile-notice">보폭 안드로이드 · 개인 AI 연결 지원<br/>국내 자료·일정은 오프라인 / 대체 관광지 AI는 개인 API 키·인터넷 필요</aside><Bopok/></>);

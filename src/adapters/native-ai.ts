export function requestNativeAI(payload:unknown):Promise<unknown>{return new Promise((resolve,reject)=>{
  const bridge=window.BopokAndroid;if(!bridge?.requestAI){reject(Error('Android AI 연결을 찾을 수 없습니다.'));return;}
  const id=crypto.randomUUID();const timer=setTimeout(()=>{window.removeEventListener('bopok:ai',receive);reject(Error('AI 응답 시간이 초과되었습니다.'));},45000);
  function receive(event:Event){const d=(event as CustomEvent).detail;if(d.id!==id)return;clearTimeout(timer);window.removeEventListener('bopok:ai',receive);if(d.error)reject(Error(d.error));else resolve(d.output);}
  window.addEventListener('bopok:ai',receive);try{bridge.requestAI(id,JSON.stringify(payload));}catch(e){clearTimeout(timer);window.removeEventListener('bopok:ai',receive);reject(e);}
});}

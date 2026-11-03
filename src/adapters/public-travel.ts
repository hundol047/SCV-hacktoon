// Fixed public providers only; Android uses a bounded native HTTPS bridge.
export async function publicTravelJSON(url:string,signal?:AbortSignal):Promise<unknown>{
  const native=typeof window!=='undefined'?window.BopokAndroid?.requestTravel:undefined;
  if(native)return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();let timer:ReturnType<typeof setTimeout>;
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('bopok:travel',receive);signal?.removeEventListener('abort',abort);};
    const stop=()=>{try{window.BopokAndroid?.cancelTravel?.(id);}catch{}};
    const abort=()=>{stop();cleanup();reject(Error('조회가 취소되었습니다.'));};
    const receive=(event:Event)=>{const data=(event as CustomEvent).detail;if(data.id!==id)return;cleanup();data.error?reject(Error(data.error)):resolve(data.output);};
    if(signal?.aborted){reject(Error('조회가 취소되었습니다.'));return;}
    timer=setTimeout(()=>{stop();cleanup();reject(Error('서버 응답 시간이 초과되었습니다. 다시 시도하세요.'));},30000);
    window.addEventListener('bopok:travel',receive);signal?.addEventListener('abort',abort,{once:true});
    try{native(id,url);}catch(e){cleanup();reject(e);}
  });
  const response=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000),credentials:'omit',redirect:'error'});
  if(!response.ok)throw Error(response.status===429?'공개 서버 요청 한도입니다. 잠시 후 다시 시도하세요.':'외부 서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.');
  if(!response.body)throw Error('빈 서버 응답입니다.');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>4000000)throw Error('응답이 너무 큽니다. 구간을 나누어 조회하세요.');chunks.push(value);}}finally{await reader.cancel();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}

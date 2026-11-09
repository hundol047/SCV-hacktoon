'use client';
import {useEffect,useRef,useState} from 'react';
import {Mic,Square} from 'lucide-react';
import {parseVoiceTrip,type VoiceTripCommand} from '../domain/voice-trip';
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;abort:()=>void};
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export default function VoiceTripInput({disabled,onCommand}:{disabled:boolean;onCommand:(command:VoiceTripCommand)=>void}){
 const [listening,setListening]=useState(false),[message,setMessage]=useState(''),[transcript,setTranscript]=useState('');const recognition=useRef<Recognition|null>(null),active=useRef(false),callback=useRef(onCommand);callback.current=onCommand;
 function stop(){active.current=false;recognition.current?.abort();recognition.current=null;setListening(false);}
 useEffect(()=>()=>{active.current=false;const r=recognition.current;recognition.current=null;r?.abort();},[]);
 useEffect(()=>{if(disabled){active.current=false;recognition.current?.abort();recognition.current=null;setListening(false);}},[disabled]);
 function start(){if(disabled)return;if(listening){stop();setMessage('음성 입력을 중지했어요.');return;}if(!window.isSecureContext){setMessage('음성 입력은 HTTPS 주소에서 사용할 수 있어요. 지금은 직접 입력해 주세요.');return;}const Constructor=(window as SpeechWindow).SpeechRecognition??(window as SpeechWindow).webkitSpeechRecognition;if(!Constructor){setMessage('이 브라우저는 음성 입력을 지원하지 않아요. Chrome 등 지원 브라우저에서 열어 주세요.');return;}
 const r=new Constructor();recognition.current=r;active.current=true;r.lang='ko-KR';r.continuous=false;r.interimResults=false;setTranscript('');setMessage('듣고 있어요. 말씀한 뒤 잠시 기다려 주세요.');setListening(true);
 r.onresult=e=>{if(!active.current||recognition.current!==r)return;active.current=false;const text=Array.from(e.results).map(result=>result[0]?.transcript??'').join(' ').trim().slice(0,600);setTranscript(text);const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());const command=parseVoiceTrip(text,today);if(command.error){setMessage(command.error);return;}if(!command.departure&&!command.region&&!command.date&&!command.days&&!command.generate){setMessage('입력할 내용을 찾지 못했어요. 예시처럼 다시 말해 주세요.');return;}callback.current(command);setMessage(command.generate?'말씀하신 조건으로 일정 생성을 요청했어요.':'말씀하신 내용을 입력했어요. “일정 만들어 줘”라고 말하면 시작합니다.');};
 r.onerror=e=>{if(!active.current||recognition.current!==r)return;active.current=false;setListening(false);setMessage(e.error==='not-allowed'||e.error==='service-not-allowed'?'마이크 권한을 허용한 뒤 다시 눌러 주세요.':e.error==='no-speech'?'음성을 듣지 못했어요. 다시 말씀해 주세요.':e.error==='audio-capture'?'마이크 연결을 확인해 주세요.':'음성 인식 연결을 확인하고 다시 시도해 주세요.');};r.onend=()=>{if(recognition.current!==r)return;active.current=false;recognition.current=null;setListening(false);};try{r.start();}catch{stop();setMessage('음성 입력을 시작하지 못했어요. 잠시 후 다시 눌러 주세요.');}
 }
 return <div className="voice-trip"><button type="button" disabled={disabled} aria-pressed={listening} onClick={start}>{listening?<Square size={16}/>:<Mic size={16}/>} {listening?'음성 입력 중지':'음성으로 입력'}</button><p>“판교역에서 내일 강릉으로 1박 2일 일정 만들어 줘”</p><small>버튼을 누르면 마이크를 사용하며, 음성이 브라우저 음성 인식 서비스로 전송될 수 있어요.</small>{transcript&&<p className="voice-transcript">들은 내용: {transcript}</p>}<p role="status">{message}</p></div>;
}

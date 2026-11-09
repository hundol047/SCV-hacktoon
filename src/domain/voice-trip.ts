import {gangwonDistricts} from '../data/gangwon-areas';
export type VoiceTripCommand={departure?:string;region?:string;date?:string;days?:number;generate:boolean;error?:string};
export function parseVoiceTrip(text:string,today:string):VoiceTripCommand{
 const out:VoiceTripCommand={generate:false};let input=text.trim().slice(0,600).replace(/[,.!?]/g,' ').replace(/(한|하루|일)\s*박/g,'1박').replace(/두\s*박/g,'2박').replace(/세\s*박/g,'3박').replace(/네\s*박/g,'4박').replace(/이틀/g,'2일').replace(/사흘/g,'3일');
 if(/취소|중지|멈춰|하지\s*마|만들지|생성하지|짜지|주지\s*마|말아|말고/.test(input))return out;
 input=input.replace(/(\d+)\s*박\s*([일이삼사오육])\s*일/g,(_,n,d)=>n+'박 '+({일:1,이:2,삼:3,사:4,오:5,육:6}[d as '일'])+'일');
 const dateInput=input;
 const origin=input.match(/(?:출발지(?:는|를)?|출발은)\s*(.+?)(?=\s+(?:여행지|목적지|도착지|날짜|출발일|기간|일정)|$)/)?.[1]??input.match(/^(.+?)에서(?:\s|$)/)?.[1];
 if(origin){out.departure=origin.replace(/^(?:내일|오늘|모레)\s+/,'').replace(/(?:으로|로)\s*(?:해\s*줘|설정해\s*줘)$/,'').trim();input=input.replace(origin,'');}
 if(out.departure&&out.departure.length>120)out.error='출발지를 120자 이내로 짧게 말해 주세요.';
 const destinations=gangwonDistricts.filter(name=>new RegExp('(?:^|\\s)'+name+'(?:시|군)?(?=\\s|으로|로|에|여행|$)').test(input));
 if(destinations.length===1)out.region=destinations[0];else if(destinations.length>1)out.error='여행 지역은 한 곳씩 말해 주세요.';
 if(!destinations.length&&/(여행지|목적지|도착지)/.test(input))out.error='강원도 내 여행 지역을 말해 주세요. 예: 여행지는 강릉';
 const directed=input.match(/(?:^|\s)([가-힣]{2,12})(?:으로|로)(?=\s|여행|일정|$)/);if(directed&&!destinations.length)out.error='강원도 내 여행 지역을 말해 주세요.';
 const namedTrip=input.match(/(?:^|\s)([가-힣]{2,12})\s*(?:여행|일정|코스)/);if(namedTrip&&!destinations.length&&!['오늘','내일','모레','당일','여행','이틀','사흘'].includes(namedTrip[1]))out.error='여행 지역을 정확히 말해 주세요. 현재 강원도 여행을 지원해요.';
 const durationInput=input.replace(/(?:\d{4}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일/g,'');
 const nights=durationInput.match(/(\d+)\s*박\s*(\d+)\s*일/),day=durationInput.match(/기간(?:은)?\s*(\d+)\s*일/)??durationInput.match(/(\d+)\s*일\s*(?:동안|여행|일정|코스|로|간)/);
 if(nights){out.days=Number(nights[2]);if(Number(nights[1])+1!==out.days)out.error='숙박 수와 여행 기간을 확인해 주세요.';}else if(/당일/.test(input))out.days=1;else if(day)out.days=Number(day[1]);
 if(out.days!==undefined&&(out.days<1||out.days>5))out.error='여행 기간은 당일부터 4박 5일까지 지원해요.';
 const full=dateInput.match(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
 if(full){const value=`${full[1]??today.slice(0,4)}-${full[2].padStart(2,'0')}-${full[3].padStart(2,'0')}`;const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==value)out.error='날짜를 다시 말해 주세요.';else if(value<today)out.error='지난 날짜예요. 연도를 포함해 다시 말해 주세요.';else out.date=value;}else {const relative=/모레/.test(dateInput)?2:/내일/.test(dateInput)?1:/오늘/.test(dateInput)?0:null;if(relative!==null){const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+relative);out.date=d.toISOString().slice(0,10);}}
 if(!out.date&&/다음\s*주|이번\s*주|요일|날짜|출발일|다음\s*달|주말/.test(dateInput))out.error='날짜는 내일·모레 또는 몇 월 며칠로 말해 주세요.';
 out.generate=!out.error&&/(?:일정|여행|코스).*(?:만들어|만들어줘|생성|짜\s*줘)|일정\s*시작/.test(input);
 return out;
}

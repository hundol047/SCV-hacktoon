import type {Place} from '../data/demo';
// Only parse unambiguous daily windows; seasonal, split and overnight hours remain textual.
export function simpleOpening(text:string){
 if(/계절|동절|하절|주말|공휴|예약|브레이크|익일|오전|오후|평일|주중|입장마감|입장 마감|\b(?:Mo|Tu|We|Th|Fr|Sa|Su)\b/.test(text))return null;
 const matches=[...text.matchAll(/(\d{1,2}):(\d{2})\s*[~–-]\s*(\d{1,2}):(\d{2})/g)];if(matches.length!==1)return null;if(/[월화수목금토일]요일/.test(text.slice(0,matches[0].index)))return null;
 const [,h,m,H,M]=matches[0];const open=Number(h)*60+Number(m),close=Number(H)*60+Number(M);
 if(open>=close||close>1440||Number(m)>59||Number(M)>59)return null;
 const weekdays=['일','월','화','수','목','금','토'];const closedWeekdays:number[]=[];
 for(let i=0;i<7;i++)if(new RegExp('(?:매주\\s*)?'+weekdays[i]+'요일\\s*(?:휴무|휴관)').test(text)||new RegExp('휴무:\\s*(?:매주\\s*)?'+weekdays[i]+'요일').test(text))closedWeekdays.push(i);
 return {open,close,closedWeekdays,closedDates:[],reservationRequired:null};
}
export function enrichOpening(place:Place,info:NonNullable<Place['visitorInfo']>,source:string):Place{
 const opening=simpleOpening(info.hoursText??'');return {...place,visitorInfo:{...place.visitorInfo,...info},...(opening?{opening:{value:opening,evidenceId:place.id+':opening',source,nature:'real' as const,checked:'source' as const,collectedAt:new Date().toISOString()}}:{})};
}

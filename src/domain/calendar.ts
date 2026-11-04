import type {PublicPlan} from './shared-plan';
import {localInstant} from './world';
const dayDate=(p:PublicPlan,day:number)=>new Date(Date.parse(p.date+'T00:00:00Z')+(day-1)*86400000).toISOString().slice(0,10);
const stamp=(value:string)=>value.replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const clock=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'');
function fold(line:string){const lines:string[]=[];let current='',size=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(size+n>75){lines.push(current);current=' ';size=1;}current+=c;size+=n;}lines.push(current);return lines.join('\r\n');}
const safe=(id:string)=>id.replace(/[^a-zA-Z0-9-]/g,'_');
export function calendarFile(p:PublicPlan,now=new Date()){
 const places=new Map(p.places.map(x=>[x.id,x]));const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Yeohaengit//Travel Plan//KO','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const item of p.items){const place=places.get(item.placeId)!;const date=dayDate(p,item.day);lines.push('BEGIN:VEVENT',`UID:${safe(p.id)}-${safe(item.id)}@yeohaengit`,`DTSTAMP:${stamp(now.toISOString())}`,`DTSTART:${stamp(localInstant(date,item.start,p.timezone))}`,`DTEND:${stamp(localInstant(date,item.end,p.timezone))}`,`SUMMARY:${escape((item.label?item.label+' · ':'')+place.name+(item.kind==='rest'?' · 휴식':item.kind==='meal'?' · 식사':''))}`,`LOCATION:${escape(place.address||place.name)}`,`DESCRIPTION:${escape(p.title+' · '+item.day+'일차\n방문 예정 일정')}`,'END:VEVENT');}
 lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
export function googleCalendarURL(p:PublicPlan,day:number){const items=p.items.filter(i=>i.day===day).sort((a,b)=>a.start-b.start);if(!items.length)return null;const date=dayDate(p,day),places=new Map(p.places.map(x=>[x.id,x]));const description=items.map(i=>`${clock(i.start)}–${clock(i.end)} ${places.get(i.placeId)?.name??''}${i.kind==='rest'?' (휴식)':''}`).join('\n');return 'https://calendar.google.com/calendar/render?'+new URLSearchParams({action:'TEMPLATE',text:`${p.title} · ${day}일차`,dates:`${stamp(localInstant(date,items[0].start,p.timezone))}/${stamp(localInstant(date,Math.max(...items.map(i=>i.end)),p.timezone))}`,ctz:p.timezone,details:description.slice(0,6000),location:p.region});}

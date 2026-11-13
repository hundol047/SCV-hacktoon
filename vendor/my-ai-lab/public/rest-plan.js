import {restEvidence} from './mobility.js';
// Use only places already on the route: no unaccounted detour or walking time.
export function restStop(previous,next,date,opts,hoursFor) {
  if(!previous||!next)return null;
  const minutes=next.start-next.travelMin-previous.end;
  if(minutes<Math.max(20,Number(opts.restMin)||0))return null;
  const needEntry=opts.access?.some(a=>['wheelchair','stroller'].includes(a));
  const candidates=[{place:previous.place,start:previous.end,end:next.start-next.travelMin,position:'before'},
    {place:next.place,start:previous.end+next.travelMin,end:next.start,position:'after'}];
  const preferred=opts.restPreferred?.[previous.place.id+':'+next.place.id];
  candidates.sort((a,b)=>Number(b.place.id===preferred)-Number(a.place.id===preferred));
  for(const c of candidates){
    const user=opts.restConfirmations?.[c.place.id];
    const userValid=user && Number.isFinite(user.checkedAt) && Date.now()>=user.checkedAt && Date.now()-user.checkedAt<7*86400000;
    const e=userValid?{seat:user.seat===true,toilet:user.toilet===true,stepFree:user.stepFree===true}:restEvidence(c.place),h=hoursFor(c.place,date);
    if(!e.seat||!e.toilet||(needEntry&&!e.stepFree))continue;
    if(!h||c.start<h.open||c.end>h.close||(h.breaks||[]).some(([a,b])=>c.start<b&&c.end>a))continue;
    return {...c,minutes,evidence:e,source:userValid?"user":"data"};
  }
  return null;
}

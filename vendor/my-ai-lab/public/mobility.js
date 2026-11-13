// A rental wheelchair or ramp alone does not establish a usable entrance.
export function stepFreeEvidence(p) {
  const a=p.access;
  if(!a?.ramp)return false;
  const raw=[a.text?.['접근로'],a.text?.['출입구']].filter(Boolean).join(' ').replace(/\s/g,'');
  if(/불가|불가능|계단만|계단이있|턱이있|단차가있|일부만|일부구간|도움필요|보조필요/.test(raw))return false;
  return /휠체어(로)?(접근|출입|진입)(이)?가능|턱이없|단차가없|무단차/.test(raw);
}
export function toiletEvidence(p) {
  const text=Object.entries(p?.access?.text||{}).filter(([key])=>/화장실/.test(key)).map(([,v])=>String(v)).join(" ").replace(/\s/g,"");
  return p?.access?.toilet===true && !/^(없음?|미설치|불가)$|화장실(이|은|는)?(없|미설치)|이용불가|사용불가|폐쇄|공사중/.test(text);
}
export function mobilityEligible(p,opts={}) {
  const a=opts.access||[];
  if(opts.lessWalk && !(Number.isFinite(p.walk)&&p.walk>=0&&p.walk<=2))return false;
  if(a.includes('shortwalk') && !(Number.isFinite(p.walk)&&p.walk>=0&&p.walk<=1))return false;
  if(a.includes('wheelchair') && (!stepFreeEvidence(p)||!(p.walk<3)))return false;
  if(a.includes('toilet') && !toiletEvidence(p))return false;
  if(a.includes('stroller') && (!stepFreeEvidence(p)||!(p.walk<3)))return false;
  return true;
}
export function mobilityOptions(opts={}) {
  const access=opts.access||[];
  return access.some(x=>['shortwalk','wheelchair','toilet','stroller'].includes(x))
    ? {...opts,pace:'relaxed',lessWalk:true,restMin:Math.max(20, Number(opts.restMin)||0)}:opts;
}

// Name a rest location only when the source explicitly supports seating and a toilet.
export function restEvidence(place) {
  const seat=Object.entries(place?.access?.text || {}).some(([key,value])=>{
    if(/유아|아기|수유|보조의자|화장실/.test(key+String(value)))return false;
    const text=String(value).replace(/\s/g,'');
    return /(벤치|의자|좌석|앉을곳).{0,12}(있|설치|마련|제공|가능)/.test(text) &&
      !/(벤치|의자|좌석|앉을곳).{0,12}(없|불가|미설치|않)/.test(text);
  });
  return {seat, toilet:toiletEvidence(place), stepFree:stepFreeEvidence(place || {})};
}

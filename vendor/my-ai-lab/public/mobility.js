// A rental wheelchair or ramp alone does not establish a usable entrance.
export function stepFreeEvidence(p) {
  const a=p.access;
  if(!a?.ramp)return false;
  const raw=[a.text?.['접근로'],a.text?.['출입구']].filter(Boolean).join(' ').replace(/\s/g,'');
  if(/불가|불가능|계단만|턱이있|단차가있/.test(raw))return false;
  return /휠체어(로)?(접근|출입|진입)(이)?가능|턱이없|단차가없|무단차/.test(raw);
}
export function mobilityEligible(p,opts={}) {
  const a=opts.access||[];
  if(a.includes('shortwalk') && !(Number.isFinite(p.walk)&&p.walk<=1))return false;
  if(a.includes('wheelchair') && (!stepFreeEvidence(p)||!(p.walk<3)))return false;
  if(a.includes('toilet') && p.access?.toilet!==true)return false;
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
  const text=Object.values(place?.access?.text || {}).join(' ');
  const seat=/벤치|의자|좌석|앉을/.test(text) && !/(벤치|의자|좌석).{0,8}(없|불가)/.test(text);
  return {seat, toilet:place?.access?.toilet===true, stepFree:stepFreeEvidence(place || {})};
}
